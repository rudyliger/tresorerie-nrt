import { PrismaClient } from "../app/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

function d(year: number, month: number, day: number) {
  // Stocker à midi UTC pour éviter tout décalage de timezone à l'affichage
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

async function main() {
  // Nettoyage
  await prisma.revenue.deleteMany();
  await prisma.payment.deleteMany();

  // ─── Comptes bancaires ────────────────────────────────────────────────────
  const [caclNrt, caclTours, bp] = await Promise.all([
    prisma.bankAccount.upsert({
      where: { code: "CACL_NRT" },
      update: { currentBalance: 48_320.50 },
      create: { name: "CACL NRT", code: "CACL_NRT", currentBalance: 48_320.50 },
    }),
    prisma.bankAccount.upsert({
      where: { code: "CACL_TOURS" },
      update: { currentBalance: 12_740.00 },
      create: { name: "CACL Tours", code: "CACL_TOURS", currentBalance: 12_740.00 },
    }),
    prisma.bankAccount.upsert({
      where: { code: "BP" },
      update: { currentBalance: -2_150.00 },
      create: { name: "Banque Populaire", code: "BP", currentBalance: -2_150.00 },
    }),
  ]);

  // ─── Entités ──────────────────────────────────────────────────────────────
  const [rnvO, rnvB, rnvT, rnvWeb, omcWeb] = await Promise.all([
    prisma.entity.upsert({ where: { code: "RNV_O" },   update: { order: 1 }, create: { name: "Renouveau Orléans",      code: "RNV_O",   order: 1 } }),
    prisma.entity.upsert({ where: { code: "RNV_B" },   update: { order: 2 }, create: { name: "Renouveau Bourges",      code: "RNV_B",   order: 2 } }),
    prisma.entity.upsert({ where: { code: "RNV_T" },   update: { order: 3 }, create: { name: "Renouveau Tours",        code: "RNV_T",   order: 3 } }),
    prisma.entity.upsert({ where: { code: "RNV_WEB" }, update: { order: 4 }, create: { name: "Renouveau Web",          code: "RNV_WEB", order: 4 } }),
    prisma.entity.upsert({ where: { code: "OMC_WEB" }, update: { order: 5 }, create: { name: "Onze Mètres Carrés Web", code: "OMC_WEB", order: 5 } }),
  ]);

  // ─── Catégories ───────────────────────────────────────────────────────────
  const [catFourn, catLoyers, catPersonnel, catFiscal, catBanque, catAutres] = await Promise.all([
    prisma.category.upsert({ where: { name: "Fournisseurs" },      update: {}, create: { name: "Fournisseurs",      order: 1 } }),
    prisma.category.upsert({ where: { name: "Loyers" },            update: {}, create: { name: "Loyers",            order: 2 } }),
    prisma.category.upsert({ where: { name: "Charges personnel" }, update: {}, create: { name: "Charges personnel", order: 3 } }),
    prisma.category.upsert({ where: { name: "Charges fiscales" },  update: {}, create: { name: "Charges fiscales",  order: 4 } }),
    prisma.category.upsert({ where: { name: "Banque" },            update: {}, create: { name: "Banque",            order: 5 } }),
    prisma.category.upsert({ where: { name: "Autres charges" },    update: {}, create: { name: "Autres charges",    order: 6 } }),
  ]);

  // ─── PAIEMENTS ────────────────────────────────────────────────────────────

  // Échéances dépassées (pour les alertes dashboard)
  await prisma.payment.createMany({ data: [
    { label: "Importex Mode Paris",   amount:  8_420.00, dueDate: d(2026, 5,  5), method: "VIREMENT",    categoryId: catFourn.id,     bankAccountId: caclNrt.id,   isPaid: false },
    { label: "TVA avril 2026",        amount:  4_180.00, dueDate: d(2026, 5, 15), method: "PRELEVEMENT", categoryId: catFiscal.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "EDF Orléans",           amount:    312.00, dueDate: d(2026, 5, 20), method: "PRELEVEMENT", categoryId: catAutres.id,    bankAccountId: caclNrt.id,   isPaid: false },
  ]});

  // À payer dans les 7 prochains jours (30 mai → 5 juin)
  await prisma.payment.createMany({ data: [
    { label: "Salaires mai — O+B",    amount: 18_600.00, dueDate: d(2026, 5, 28), method: "VIREMENT",    categoryId: catPersonnel.id, bankAccountId: caclNrt.id,   isPaid: false },
    { label: "URSSAF mai",            amount:  6_240.00, dueDate: d(2026, 5, 29), method: "PRELEVEMENT", categoryId: catPersonnel.id, bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Loyer Orléans",         amount:  3_800.00, dueDate: d(2026, 5, 30), method: "VIREMENT",    categoryId: catLoyers.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Loyer Bourges",         amount:  2_400.00, dueDate: d(2026, 5, 30), method: "VIREMENT",    categoryId: catLoyers.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Salaires mai — Tours",  amount:  6_850.00, dueDate: d(2026, 5, 30), method: "VIREMENT",    categoryId: catPersonnel.id, bankAccountId: caclTours.id, isPaid: false },
    { label: "Loyer Tours",           amount:  2_200.00, dueDate: d(2026, 6,  1), method: "VIREMENT",    categoryId: catLoyers.id,    bankAccountId: caclTours.id, isPaid: false },
    { label: "Textile Empire",        amount:  5_100.00, dueDate: d(2026, 6,  2), method: "EFFET",       categoryId: catFourn.id,     bankAccountId: bp.id,        isPaid: false },
    { label: "Remboursement prêt BP", amount:  1_245.00, dueDate: d(2026, 6,  5), method: "PRELEVEMENT", categoryId: catBanque.id,    bankAccountId: bp.id,        isPaid: false },
    { label: "Téléphonie + internet", amount:    380.00, dueDate: d(2026, 6,  5), method: "PRELEVEMENT", categoryId: catAutres.id,    bankAccountId: caclNrt.id,   isPaid: false },
  ]});

  // Reste de juin 2026
  await prisma.payment.createMany({ data: [
    // Fournisseurs
    { label: "Fashion Link",          amount: 12_300.00, dueDate: d(2026, 6,  8), method: "VIREMENT",    categoryId: catFourn.id,     bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Assurance multirisques",amount:    520.00, dueDate: d(2026, 6, 10), method: "PRELEVEMENT", categoryId: catAutres.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Sud Mode Distrib.",     amount:  7_650.00, dueDate: d(2026, 6, 10), method: "EFFET",       categoryId: catFourn.id,     bankAccountId: bp.id,        isPaid: false },
    { label: "Vetex SAS",             amount:  4_200.00, dueDate: d(2026, 6, 12), method: "VIREMENT",    categoryId: catFourn.id,     bankAccountId: caclNrt.id,   isPaid: false },
    { label: "TVA mai 2026",          amount:  5_840.00, dueDate: d(2026, 6, 15), method: "PRELEVEMENT", categoryId: catFiscal.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "CFE Orléans",           amount:  1_120.00, dueDate: d(2026, 6, 15), method: "PRELEVEMENT", categoryId: catFiscal.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Label Sport Paris",     amount:  3_890.00, dueDate: d(2026, 6, 15), method: "CHEQUE",      categoryId: catFourn.id,     bankAccountId: caclNrt.id,   isPaid: false },
    { label: "EDF Orléans",           amount:    312.00, dueDate: d(2026, 6, 20), method: "PRELEVEMENT", categoryId: catAutres.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "EDF Bourges",           amount:    245.00, dueDate: d(2026, 6, 20), method: "PRELEVEMENT", categoryId: catAutres.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "EDF Tours",             amount:    198.00, dueDate: d(2026, 6, 20), method: "PRELEVEMENT", categoryId: catAutres.id,    bankAccountId: caclTours.id, isPaid: false },
    { label: "Importex Mode Paris",   amount:  9_100.00, dueDate: d(2026, 6, 20), method: "VIREMENT",    categoryId: catFourn.id,     bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Salaires juin — O+B",   amount: 18_600.00, dueDate: d(2026, 6, 27), method: "VIREMENT",    categoryId: catPersonnel.id, bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Salaires juin — Tours", amount:  6_850.00, dueDate: d(2026, 6, 27), method: "VIREMENT",    categoryId: catPersonnel.id, bankAccountId: caclTours.id, isPaid: false },
    { label: "URSSAF juin",           amount:  6_240.00, dueDate: d(2026, 6, 29), method: "PRELEVEMENT", categoryId: catPersonnel.id, bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Loyer Orléans",         amount:  3_800.00, dueDate: d(2026, 6, 30), method: "VIREMENT",    categoryId: catLoyers.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Loyer Bourges",         amount:  2_400.00, dueDate: d(2026, 6, 30), method: "VIREMENT",    categoryId: catLoyers.id,    bankAccountId: caclNrt.id,   isPaid: false },
    { label: "Agios CACL NRT",        amount:    180.00, dueDate: d(2026, 6, 30), method: "PRELEVEMENT", categoryId: catBanque.id,    bankAccountId: caclNrt.id,   isPaid: false },
  ]});

  // ─── RECETTES ─────────────────────────────────────────────────────────────

  // Semaine passée (mai)
  await prisma.revenue.createMany({ data: [
    { entityId: rnvO.id,   amount: 14_200.00, date: d(2026, 5, 24) },
    { entityId: rnvB.id,   amount:  8_900.00, date: d(2026, 5, 24) },
    { entityId: rnvT.id,   amount:  7_100.00, date: d(2026, 5, 24) },
    { entityId: rnvWeb.id, amount:  3_450.00, date: d(2026, 5, 24) },
    { entityId: omcWeb.id, amount:  2_180.00, date: d(2026, 5, 24) },
    { entityId: rnvO.id,   amount: 15_600.00, date: d(2026, 5, 26) },
    { entityId: rnvB.id,   amount:  9_400.00, date: d(2026, 5, 26) },
    { entityId: rnvT.id,   amount:  6_800.00, date: d(2026, 5, 26) },
    { entityId: rnvWeb.id, amount:  4_100.00, date: d(2026, 5, 26) },
    { entityId: omcWeb.id, amount:  1_950.00, date: d(2026, 5, 26) },
  ]});

  // Juin 2026 (semaines 7, 14, 21, 28)
  await prisma.revenue.createMany({ data: [
    { entityId: rnvO.id,   amount: 16_800.00, date: d(2026, 6,  7) },
    { entityId: rnvB.id,   amount: 10_200.00, date: d(2026, 6,  7) },
    { entityId: rnvT.id,   amount:  8_400.00, date: d(2026, 6,  7) },
    { entityId: rnvWeb.id, amount:  5_200.00, date: d(2026, 6,  7) },
    { entityId: omcWeb.id, amount:  2_600.00, date: d(2026, 6,  7) },
    { entityId: rnvO.id,   amount: 18_500.00, date: d(2026, 6, 14) },
    { entityId: rnvB.id,   amount: 11_400.00, date: d(2026, 6, 14) },
    { entityId: rnvT.id,   amount:  9_100.00, date: d(2026, 6, 14) },
    { entityId: rnvWeb.id, amount:  4_800.00, date: d(2026, 6, 14) },
    { entityId: omcWeb.id, amount:  3_100.00, date: d(2026, 6, 14) },
    { entityId: rnvO.id,   amount: 17_200.00, date: d(2026, 6, 21) },
    { entityId: rnvB.id,   amount: 10_800.00, date: d(2026, 6, 21) },
    { entityId: rnvT.id,   amount:  8_600.00, date: d(2026, 6, 21) },
    { entityId: rnvWeb.id, amount:  5_400.00, date: d(2026, 6, 21) },
    { entityId: omcWeb.id, amount:  2_900.00, date: d(2026, 6, 21) },
    { entityId: rnvO.id,   amount: 19_400.00, date: d(2026, 6, 28) },
    { entityId: rnvB.id,   amount: 12_100.00, date: d(2026, 6, 28) },
    { entityId: rnvT.id,   amount:  9_800.00, date: d(2026, 6, 28) },
    { entityId: rnvWeb.id, amount:  6_100.00, date: d(2026, 6, 28) },
    { entityId: omcWeb.id, amount:  3_400.00, date: d(2026, 6, 28) },
  ]});

  console.log("Seed terminé — données de test NRT Associés créées.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// Seed prêts de démonstration (ajout à la suite du seed existant)
