import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";

export async function POST(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const session = verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { firstName, lastName, email, department } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const groupName = department || "New Group";

    // 1. Find if a group with this name already exists for the current user
    let group = await db.group.findFirst({
      where: { 
        name: groupName,
        userId: session.userId 
      },
    });

    // 2. If the group doesn't exist, create it
    if (!group) {
      group = await db.group.create({
        data: {
          userId: session.userId,
          name: groupName,
          modifiedDate: new Date(),
        },
      });
    }

    // 3. Create the target and link it to the group via GroupTarget
    const target = await db.target.create({
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email,
        department: department || null,
        position: "Member",
        groups: {
          create: {
            groupId: group.id,
          }
        }
      }
    });

    return NextResponse.json({ group, target }, { status: 201 });
  } catch (error) {
    console.error("Failed to create target:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}