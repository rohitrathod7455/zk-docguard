import { prisma } from '../src/db/client.js';

async function seed() {
  console.log('=======================================================');
  console.log('   ZK-DocGuard Phase 11: Demo Environment Seeding      ');
  console.log('=======================================================');

  const demoAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
  const demoDid = 'did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const demoZkKeyHash = '0x050e883190a62733ef5ad87afb2e96bd4eb6e3e48b346d45f0a1f0e084d64747';
  const demoMetadataURI = 'https://northfield.edu/accreditation/zk-metadata.json';

  // 1. Seed Institutional Issuer: Northfield Institute of Technology
  const issuer = await prisma.issuer.upsert({
    where: { address: demoAddress },
    update: {
      did: demoDid,
      zkKeyHash: demoZkKeyHash,
      metadataURI: demoMetadataURI,
      status: 'Active',
      approvedAt: new Date(),
    },
    create: {
      address: demoAddress,
      did: demoDid,
      zkKeyHash: demoZkKeyHash,
      metadataURI: demoMetadataURI,
      status: 'Active',
      approvedAt: new Date(),
    },
  });
  console.log(`[1/4] ✔ Institutional Issuer: Northfield Institute of Technology (${issuer.address})`);

  // 2. Seed Holder 1: Alex Vance (Honors Graduate, Valid)
  const alexDocHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
  const alexCredId = '0x2222222222222222222222222222222222222222222222222222222222222222';
  const schemaId = '0x3333333333333333333333333333333333333333333333333333333333333333';
  const alexCid = 'QmAlexVanceNorthfieldDegree2026Ciphertext';

  await prisma.credentialRecord.upsert({
    where: { docHash: alexDocHash },
    update: {
      credentialId: alexCredId,
      schemaId,
      cid: alexCid,
      status: 'Valid',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
    create: {
      docHash: alexDocHash,
      credentialId: alexCredId,
      schemaId,
      cid: alexCid,
      status: 'Valid',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
  });
  console.log(`[2/4] ✔ Demo Holder 1: Alex Vance (BTech CSE 2026, CGPA 3.85, Valid)`);

  // 3. Seed Holder 2: Elena Rostova (Valid)
  const elenaDocHash = '0x4444444444444444444444444444444444444444444444444444444444444444';
  const elenaCredId = '0x5555555555555555555555555555555555555555555555555555555555555555';
  const elenaCid = 'QmElenaRostovaNorthfieldDegree2025Ciphertext';

  await prisma.credentialRecord.upsert({
    where: { docHash: elenaDocHash },
    update: {
      credentialId: elenaCredId,
      schemaId,
      cid: elenaCid,
      status: 'Valid',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
    create: {
      docHash: elenaDocHash,
      credentialId: elenaCredId,
      schemaId,
      cid: elenaCid,
      status: 'Valid',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
  });
  console.log(`[3/4] ✔ Demo Holder 2: Elena Rostova (BTech CSE 2025, CGPA 3.40, Valid)`);

  // 4. Seed Holder 3: Marcus Brody (Revoked)
  const marcusDocHash = '0x7777777777777777777777777777777777777777777777777777777777777777';
  const marcusCredId = '0x8888888888888888888888888888888888888888888888888888888888888888';
  const marcusCid = 'QmMarcusBrodyNorthfieldDegree2024Ciphertext';

  await prisma.credentialRecord.upsert({
    where: { docHash: marcusDocHash },
    update: {
      credentialId: marcusCredId,
      schemaId,
      cid: marcusCid,
      status: 'Revoked',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
    create: {
      docHash: marcusDocHash,
      credentialId: marcusCredId,
      schemaId,
      cid: marcusCid,
      status: 'Revoked',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
  });

  // Seed revocation leaf for Marcus Brody
  await prisma.revocationLeaf.upsert({
    where: {
      issuerKeyHash_credentialId: {
        issuerKeyHash: demoZkKeyHash,
        credentialId: marcusCredId,
      },
    },
    update: {
      issuerAddress: demoAddress,
      revokedAt: new Date(),
    },
    create: {
      issuerKeyHash: demoZkKeyHash,
      credentialId: marcusCredId,
      issuerAddress: demoAddress,
    },
  });
  console.log(`[4/4] ✔ Demo Holder 3: Marcus Brody (MTech AI 2024, Status: Revoked)`);

  // 5. Seed historical SMT root
  const sampleSmtRoot = '0x0e37713dff19d4e481a77d16871717118374a3056a47fc24e7a9bc10d40459e2';
  const existingRoot = await prisma.smtRoot.findFirst({
    where: {
      issuerKeyHash: demoZkKeyHash,
      root: sampleSmtRoot,
    },
  });
  if (!existingRoot) {
    await prisma.smtRoot.create({
      data: {
        issuerKeyHash: demoZkKeyHash,
        root: sampleSmtRoot,
        epoch: 1,
      },
    });
  }

  console.log('\n✔ All demo entities, institutions, and credentials seeded successfully!');
}

seed()
  .catch((err) => {
    console.error('Seed execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
