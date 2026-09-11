import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const counts = {
    users: await prisma.user.count(),
    groups: await prisma.group.count(),
    targets: await prisma.target.count(),
    templates: await prisma.template.count(),
    pages: await prisma.landingPage.count(),
    profiles: await prisma.sendingProfile.count(),
    campaigns: await prisma.campaign.count(),
    results: await prisma.result.count(),
    events: await prisma.simEvent.count(),
  };
  console.table(counts);

  const campaign = await prisma.campaign.findFirst({
    include: { results: true, _count: { select: { events: true } } },
  });
  console.log(JSON.stringify(campaign, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
