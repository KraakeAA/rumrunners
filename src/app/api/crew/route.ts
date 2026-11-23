import { denyIfDead } from "@/lib/alive";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { splitTransfer } from "@/lib/fees";
import { getSessionUserId } from "@/lib/session";
import {
  CREW_COST,
  MAX_ANSWER_LENGTH,
  MAX_CREWS,
  MAX_MEMBERS,
  MAX_MOTTO_LENGTH,
  cleanCrewName,
  cleanQuestions,
  isCrewColour,
  questionsOf
} from "@/lib/crew";

class Refuse extends Error {}

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

async function mail(toId: string, fromName: string, subject: string, body: string) {
  try {
    await prisma.message.create({ data: { toId, fromName, subject, body } });
  } catch {
    /* the letter is a courtesy; the action has already happened */
  }
}

// Everything the Crew screen needs for this player.
async function view(playerId: string) {
  const me = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, username: true, money: true, crewId: true }
  });
  if (!me) return null;

  const crews = await prisma.crew.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true, _count: { select: { members: true } } }
  });

  let mine = null;
  if (me.crewId) {
    const crew = await prisma.crew.findUnique({
      where: { id: me.crewId },
      select: {
        id: true,
        name: true,
        color: true,
        motto: true,
        questions: true,
        bank: true,
        leaderId: true,
        createdAt: true,
        leader: { select: { username: true } },
        members: { select: { id: true, username: true, rank: true, rankLevel: true } }
      }
    });
    if (crew) {
      const isLeader = crew.leaderId === me.id;
      const given = await prisma.crewDonation.groupBy({
        by: ["playerId"],
        where: { crewId: crew.id },
        _sum: { amount: true }
      });
      const givenBy = new Map(given.map((g) => [g.playerId, g._sum.amount ?? 0]));

      let applications: {
        id: string;
        username: string;
        rank: string;
        answers: string[];
        createdAt: string;
      }[] = [];
      if (isLeader) {
        const rows = await prisma.crewApplication.findMany({
          where: { crewId: crew.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            answers: true,
            createdAt: true,
            player: { select: { username: true, rank: true } }
          }
        });
        applications = rows.map((r) => ({
          id: r.id,
          username: r.player.username,
          rank: r.player.rank,
          answers: questionsOf(r.answers),
          createdAt: r.createdAt.toISOString()
        }));
      }

      mine = {
        id: crew.id,
        name: crew.name,
        color: crew.color,
        motto: crew.motto ?? "",
        questions: questionsOf(crew.questions),
        bank: crew.bank,
        isLeader,
        leaderName: crew.leader.username,
        createdAt: crew.createdAt.toISOString(),
        members: crew.members
          .map((m) => ({
            username: m.username,
            rank: m.rank,
            isLeader: m.id === crew.leaderId,
            donated: givenBy.get(m.id) ?? 0
          }))
          .sort((a, b) => Number(b.isLeader) - Number(a.isLeader) || a.username.localeCompare(b.username)),
        applications
      };
    }
  }

  return {
    money: me.money,
    cost: CREW_COST,
    maxCrews: MAX_CREWS,
    maxMembers: MAX_MEMBERS,
    crewCount: crews.length,
    crews: crews.map((c) => ({ id: c.id, name: c.name, color: c.color, members: c._count.members })),
    mine
  };
}

export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const me = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    // The questionnaire for one crew, shown when you press Apply.
    const apply = new URL(req.url).searchParams.get("apply");
    if (apply) {
      const crew = await prisma.crew.findUnique({
        where: { id: apply },
        select: { id: true, name: true, color: true, questions: true, _count: { select: { members: true } } }
      });
      if (!crew) return NextResponse.json({ error: "That crew no longer exists." }, { status: 404 });
      const pending = await prisma.crewApplication.findUnique({
        where: { crewId_playerId: { crewId: crew.id, playerId: me.id } },
        select: { id: true }
      });
      return NextResponse.json({
        id: crew.id,
        name: crew.name,
        color: crew.color,
        questions: questionsOf(crew.questions),
        members: crew._count.members,
        maxMembers: MAX_MEMBERS,
        alreadyApplied: Boolean(pending)
      });
    }

    return NextResponse.json(await view(me.id));
  } catch (error) {
    console.error("Crew load failed:", error);
    return NextResponse.json({ error: "Crews could not be loaded." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const __dead = await denyIfDead();
  if (__dead) return __dead;

  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const me = await prisma.player.findUnique({
      where: { userId },
      select: { id: true, username: true, money: true, crewId: true }
    });
    if (!me) return NextResponse.json({ error: "Player not found." }, { status: 404 });

    let message = "";

    // ---------------------------------------------------------------- start
    if (action === "start") {
      const name = cleanCrewName(body.name);
      if (!name) {
        return NextResponse.json(
          { error: "Pick a name of 3 to 24 characters: letters, numbers, spaces and . ' & -" },
          { status: 400 }
        );
      }
      if (!isCrewColour(body.color)) {
        return NextResponse.json({ error: "Choose a colour for your crew." }, { status: 400 });
      }
      const color = body.color;

      await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUnique({ where: { id: me.id } });
        if (!player) throw new Refuse("Player not found.");
        if (player.crewId) throw new Refuse("You are already in a crew.");
        if ((await tx.crew.count()) >= MAX_CREWS) {
          throw new Refuse(`There are already ${MAX_CREWS} crews. No more can be started.`);
        }
        const taken = await tx.crew.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
          select: { id: true }
        });
        if (taken) throw new Refuse("A crew with that name already exists.");

        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: CREW_COST } },
          data: { money: { decrement: CREW_COST } }
        });
        if (paid.count !== 1) throw new Refuse(`Starting a crew costs ${gbp(CREW_COST)}. You don't have enough cash.`);

        const crew = await tx.crew.create({ data: { name, color, leaderId: me.id } });
        await tx.player.update({ where: { id: me.id }, data: { crewId: crew.id } });
        // Anything else you had applied for no longer matters.
        await tx.crewApplication.deleteMany({ where: { playerId: me.id } });
      });
      message = `${name} is yours. You lead the crew.`;
    }

    // ---------------------------------------------------------------- apply
    else if (action === "apply") {
      const crewId = String(body.crewId ?? "");
      const answersIn: unknown[] = Array.isArray(body.answers) ? body.answers : [];

      const crew = await prisma.crew.findUnique({
        where: { id: crewId },
        select: { id: true, name: true, leaderId: true, questions: true, _count: { select: { members: true } } }
      });
      if (!crew) return NextResponse.json({ error: "That crew no longer exists." }, { status: 404 });
      if (me.crewId) return NextResponse.json({ error: "You are already in a crew." }, { status: 400 });
      if (crew._count.members >= MAX_MEMBERS) {
        return NextResponse.json({ error: "That crew is full." }, { status: 400 });
      }

      const questions = questionsOf(crew.questions);
      const answers = questions.map((_, i) => String(answersIn[i] ?? "").trim().slice(0, MAX_ANSWER_LENGTH));
      if (answers.some((a) => a.length === 0)) {
        return NextResponse.json({ error: "Please answer every question." }, { status: 400 });
      }

      const existing = await prisma.crewApplication.findUnique({
        where: { crewId_playerId: { crewId: crew.id, playerId: me.id } },
        select: { id: true }
      });
      if (existing) {
        return NextResponse.json({ error: "You have already applied to that crew." }, { status: 400 });
      }

      await prisma.crewApplication.create({
        data: { crewId: crew.id, playerId: me.id, answers: JSON.parse(JSON.stringify(answers)) }
      });
      await mail(
        crew.leaderId,
        me.username,
        `Crew application: ${me.username}`,
        `${me.username} has applied to join ${crew.name}. Open Crew to read the answers and decide.`
      );
      message = `Your application to ${crew.name} has been sent.`;
    }

    // --------------------------------------------------------------- review
    else if (action === "review") {
      const applicationId = String(body.applicationId ?? "");
      const accept = body.accept === true;

      const crew = me.crewId
        ? await prisma.crew.findUnique({ where: { id: me.crewId }, select: { id: true, name: true, leaderId: true } })
        : null;
      if (!crew || crew.leaderId !== me.id) {
        return NextResponse.json({ error: "Only the leader can do that." }, { status: 403 });
      }

      const app = await prisma.crewApplication.findUnique({
        where: { id: applicationId },
        select: { id: true, crewId: true, playerId: true, player: { select: { username: true, crewId: true } } }
      });
      if (!app || app.crewId !== crew.id) {
        return NextResponse.json({ error: "That application is no longer there." }, { status: 404 });
      }

      if (!accept) {
        await prisma.crewApplication.delete({ where: { id: app.id } });
        await mail(app.playerId, crew.name, `${crew.name}: application declined`, `${crew.name} has turned down your application.`);
        message = `${app.player.username}'s application was declined.`;
      } else {
        await prisma.$transaction(async (tx) => {
          if (app.player.crewId) throw new Refuse("That player has already joined another crew.");
          if ((await tx.player.count({ where: { crewId: crew.id } })) >= MAX_MEMBERS) {
            throw new Refuse("Your crew is full.");
          }
          await tx.player.update({ where: { id: app.playerId }, data: { crewId: crew.id } });
          // Their other applications fall away.
          await tx.crewApplication.deleteMany({ where: { playerId: app.playerId } });
        });
        await mail(app.playerId, crew.name, `Welcome to ${crew.name}`, `${crew.name} has accepted you. You are now a member.`);
        message = `${app.player.username} has joined the crew.`;
      }
    }
    // --------------------------------------------------------------- donate
    else if (action === "donate") {
      const amount = Number(body.amount);
      if (!Number.isSafeInteger(amount) || amount < 1) {
        return NextResponse.json({ error: "Enter a whole number of pounds." }, { status: 400 });
      }
      if (!me.crewId) return NextResponse.json({ error: "You are not in a crew." }, { status: 400 });
      const crewId = me.crewId;

      await prisma.$transaction(async (tx) => {
        const paid = await tx.player.updateMany({
          where: { id: me.id, money: { gte: amount } },
          data: { money: { decrement: amount } }
        });
        if (paid.count !== 1) throw new Refuse("You don't have that much cash.");
        // Donations go in whole. The 10% fee is taken when the leader withdraws.
        await tx.crew.update({ where: { id: crewId }, data: { bank: { increment: amount } } });
        await tx.crewDonation.create({ data: { crewId, playerId: me.id, amount } });
      });
      message = `You put ${gbp(amount)} into the crew bank.`;
    }

    // ------------------------------------------------------------- withdraw
    else if (action === "withdraw") {
      const amount = Number(body.amount);
      if (!Number.isSafeInteger(amount) || amount < 1) {
        return NextResponse.json({ error: "Enter a whole number of pounds." }, { status: 400 });
      }
      const crew = me.crewId
        ? await prisma.crew.findUnique({ where: { id: me.crewId }, select: { id: true, leaderId: true } })
        : null;
      if (!crew || crew.leaderId !== me.id) {
        return NextResponse.json({ error: "Only the leader can take money out of the crew bank." }, { status: 403 });
      }

      await prisma.$transaction(async (tx) => {
        const taken = await tx.crew.updateMany({
          where: { id: crew.id, bank: { gte: amount } },
          data: { bank: { decrement: amount } }
        });
        if (taken.count !== 1) throw new Refuse("The crew bank doesn't hold that much.");
        // The leader takes the money out less the 10% fee.
        const { received } = splitTransfer(amount);
        await tx.player.update({ where: { id: me.id }, data: { money: { increment: received } } });
      });
      const { received: landed, fee } = splitTransfer(amount);
      message = `You took ${gbp(amount)} out of the crew bank. ${gbp(fee)} was taken as the 10% fee, so you received ${gbp(landed)}.`;
    }

    // ----------------------------------------------------------------- edit
    else if (action === "edit") {
      const crew = me.crewId
        ? await prisma.crew.findUnique({ where: { id: me.crewId }, select: { id: true, leaderId: true } })
        : null;
      if (!crew || crew.leaderId !== me.id) {
        return NextResponse.json({ error: "Only the leader can change the crew." }, { status: 403 });
      }

      const data: { motto?: string | null; color?: string; questions?: Prisma.InputJsonValue } = {};
      if (body.motto !== undefined) {
        const motto = String(body.motto ?? "").trim();
        if (motto.length > MAX_MOTTO_LENGTH) {
          return NextResponse.json({ error: `The crew description can be up to ${MAX_MOTTO_LENGTH} characters.` }, { status: 400 });
        }
        data.motto = motto || null;
      }
      if (body.color !== undefined) {
        if (!isCrewColour(body.color)) return NextResponse.json({ error: "Choose one of the colours." }, { status: 400 });
        data.color = body.color;
      }
      if (body.questions !== undefined) {
        data.questions = JSON.parse(JSON.stringify(cleanQuestions(body.questions)));
      }
      await prisma.crew.update({ where: { id: crew.id }, data });
      message = "Saved.";
    }

    // ----------------------------------------------------------------- kick
    else if (action === "kick") {
      const name = String(body.username ?? "");
      const crew = me.crewId
        ? await prisma.crew.findUnique({ where: { id: me.crewId }, select: { id: true, name: true, leaderId: true } })
        : null;
      if (!crew || crew.leaderId !== me.id) {
        return NextResponse.json({ error: "Only the leader can remove members." }, { status: 403 });
      }
      const target = await prisma.player.findFirst({
        where: { username: { equals: name, mode: "insensitive" }, crewId: crew.id },
        select: { id: true, username: true }
      });
      if (!target) return NextResponse.json({ error: "That player isn't in your crew." }, { status: 404 });
      if (target.id === me.id) {
        return NextResponse.json({ error: "You can't remove yourself. Disband the crew instead." }, { status: 400 });
      }
      await prisma.player.update({ where: { id: target.id }, data: { crewId: null } });
      await mail(target.id, crew.name, `Removed from ${crew.name}`, `You have been removed from ${crew.name}.`);
      message = `${target.username} has been removed.`;
    }

    // ---------------------------------------------------------------- leave
    else if (action === "leave") {
      if (!me.crewId) return NextResponse.json({ error: "You are not in a crew." }, { status: 400 });
      const crew = await prisma.crew.findUnique({ where: { id: me.crewId }, select: { leaderId: true, name: true } });
      if (crew && crew.leaderId === me.id) {
        return NextResponse.json({ error: "A leader can't leave. Disband the crew instead." }, { status: 400 });
      }
      await prisma.player.update({ where: { id: me.id }, data: { crewId: null } });
      message = `You left ${crew?.name ?? "the crew"}.`;
    }

    // -------------------------------------------------------------- disband
    else if (action === "disband") {
      const crew = me.crewId
        ? await prisma.crew.findUnique({ where: { id: me.crewId }, select: { id: true, name: true, leaderId: true, bank: true } })
        : null;
      if (!crew || crew.leaderId !== me.id) {
        return NextResponse.json({ error: "Only the leader can disband the crew." }, { status: 403 });
      }
      const others = await prisma.player.findMany({
        where: { crewId: crew.id, NOT: { id: me.id } },
        select: { id: true }
      });
      await prisma.$transaction(async (tx) => {
        // Whatever is left in the crew bank goes to the leader.
        const fresh = await tx.crew.findUnique({ where: { id: crew.id }, select: { bank: true } });
        if (fresh && fresh.bank > 0) {
          await tx.player.update({ where: { id: me.id }, data: { money: { increment: fresh.bank } } });
        }
        await tx.player.update({ where: { id: me.id }, data: { crewId: null } });
        // The crew's private forum goes with it.
        await tx.forumTopic.deleteMany({ where: { category: `CREW:${crew.id}` } });
        await tx.crew.delete({ where: { id: crew.id } });
      });
      for (const o of others) {
        await mail(o.id, crew.name, `${crew.name} has been disbanded`, `${crew.name} was disbanded by its leader.`);
      }
      message = `${crew.name} has been disbanded.`;
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message, ...(await view(me.id)) });
  } catch (error) {
    if (error instanceof Refuse) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Crew action failed:", error);
    return NextResponse.json({ error: "That could not be completed." }, { status: 500 });
  }
}

