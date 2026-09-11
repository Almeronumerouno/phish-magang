import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function rid() {
  return crypto.randomBytes(9).toString("base64url").slice(0, 12);
}

async function upsertUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      hash,
      apiKey: crypto.randomBytes(16).toString("hex"),
    },
  });
}

async function main() {
  if (await prisma.campaign.findFirst({ where: { name: "Q3 Payroll Test" } })) {
    console.log("Seed skipped: demo data already exists");
    return;
  }

  const operator = await upsertUser("operator@company.com", "admin123");
  await upsertUser("admin@company.com", "gophish123");

  const group = await prisma.group.create({
    data: {
      name: "IT & Digital Operations",
      userId: operator.id,
      targets: {
        create: [
          {
            target: {
              create: {
                firstName: "Budi",
                lastName: "Santoso",
                email: "budi.santoso@company.com",
                position: "IT Staff",
                department: "IT & Digital Operations",
              },
            },
          },
          {
            target: {
              create: {
                firstName: "Sari",
                lastName: "Wijaya",
                email: "sari.wijaya@company.com",
                position: "DevOps Engineer",
                department: "IT & Digital Operations",
              },
            },
          },
        ],
      },
    },
    include: { targets: { include: { target: true } } },
  });

  const template = await prisma.template.create({
    data: {
      name: "HR NYOBA",
      subject: "Informasi Payroll Q3 - Aksi Diperlukan",
      text: "Halo {{.FirstName}}, silakan verifikasi data payroll Anda di {{.URL}} ({{.Tracker}})",
      html: "<p>Halo {{.FirstName}},</p><p>Silakan verifikasi data payroll Anda <a href=\"{{.URL}}\">di sini</a>.</p><img src=\"{{.Tracker}}\" />",
      userId: operator.id,
    },
  });

  const page = await prisma.landingPage.create({
    data: {
      name: "BCA Login",
      html: "<form><input name=\"username\" /><input name=\"password\" type=\"password\" /><button>Masuk</button></form>",
      captureCredentials: true,
      userId: operator.id,
    },
  });

  const profile = await prisma.sendingProfile.create({
    data: {
      name: "Default Mailer",
      host: "smtp.company.com:587",
      username: "helpdesk@simulation-domain.com",
      password: "changeme",
      fromAddress: "\"IT Helpdesk\" <helpdesk@simulation-domain.com>",
      userId: operator.id,
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: "Q3 Payroll Test",
      status: "In_Progress",
      url: "http://127.0.0.1:8080",
      userId: operator.id,
      templateId: template.id,
      pageId: page.id,
      smtpId: profile.id,
      groupId: group.id,
      launchDate: new Date(),
    },
  });

  for (const [i, gt] of group.targets.entries()) {
    await prisma.result.create({
      data: {
        campaignId: campaign.id,
        userId: operator.id,
        rId: rid(),
        email: gt.target.email,
        firstName: gt.target.firstName,
        lastName: gt.target.lastName,
        position: gt.target.position,
        status: i === 0 ? "Sent" : "Clicked",
        sendDate: new Date(),
      },
    });
    await prisma.simEvent.create({
      data: {
        campaignId: campaign.id,
        email: gt.target.email,
        message: i === 0 ? "Email Sent" : "Email Clicked",
        details: i === 0 ? "Accepted by relay" : "Clicked phishing link",
      },
    });
  }

  console.log("Seed OK: campaign Q3 Payroll Test + 2 results + 2 events");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
