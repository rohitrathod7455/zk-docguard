import { prisma } from '../src/db/client.js';

async function seed() {
  console.log('Seeding ZK-DocGuard demo data...');

  const demoAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
  const demoDid = 'did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const demoZkKeyHash = '0x050e883190a62733ef5ad87afb2e96bd4eb6e3e48b346d45f0a1f0e084d64747';
  const demoMetadataURI = 'https://northfield.edu/accreditation/zk-metadata.json';

  // 1. Seed demo institutional issuer
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

  console.log(`✅ Seeded demo institution: Northfield Institute of Technology (${issuer.address})`);

  // 2. Seed a sample credential anchor record
  const sampleDocHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
  const sampleCredentialId = '0x2222222222222222222222222222222222222222222222222222222222222222';
  const sampleSchemaId = '0x3333333333333333333333333333333333333333333333333333333333333333';
  const sampleCid = 'QmNorthfieldDegreeDemoCiphertextCID1234567890';

  const cred = await prisma.credentialRecord.upsert({
    where: { docHash: sampleDocHash },
    update: {
      credentialId: sampleCredentialId,
      schemaId: sampleSchemaId,
      cid: sampleCid,
      status: 'Valid',
      issuerAddress: demoAddress,
      expiry: 4102444800n, // Jan 1 2100
    },
    create: {
      docHash: sampleDocHash,
      credentialId: sampleCredentialId,
      schemaId: sampleSchemaId,
      cid: sampleCid,
      status: 'Valid',
      issuerAddress: demoAddress,
      expiry: 4102444800n,
    },
  });

  console.log(`✅ Seeded demo credential record: ${cred.docHash}`);
  console.log('Seed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
