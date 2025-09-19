const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestReflink() {
  try {
    console.log('Creating test reflink...');

    // Create a test reflink
    const testReflink = await prisma.aIReflink.create({
      data: {
        code: 'test-premium',
        name: 'Test Premium Access',
        description: 'Test reflink for premium AI features',
        rateLimitTier: 'PREMIUM',
        dailyLimit: 200,
        recipientName: 'Test User',
        recipientEmail: 'test@example.com',
        customContext: 'This is a test reflink for development and testing purposes. You have access to all premium AI features including voice AI, job analysis, and advanced navigation.',
        tokenLimit: 100000,
        spendLimit: 50.00,
        enableVoiceAI: true,
        enableJobAnalysis: true,
        enableAdvancedNavigation: true,
        isActive: true,
      },
    });

    console.log('✅ Test reflink created successfully:');
    console.log(`   Code: ${testReflink.code}`);
    console.log(`   Name: ${testReflink.name}`);
    console.log(`   Recipient: ${testReflink.recipientName}`);
    console.log(`   Features: Voice AI, Job Analysis, Advanced Navigation`);
    console.log(`   Budget: $${testReflink.spendLimit} / ${testReflink.tokenLimit} tokens`);
    console.log(`   Test URL: http://localhost:3000/test-reflink?ref=${testReflink.code}`);

    // Create another test reflink with limited features
    const limitedReflink = await prisma.aIReflink.create({
      data: {
        code: 'test-limited',
        name: 'Test Limited Access',
        description: 'Test reflink with limited AI features',
        rateLimitTier: 'STANDARD',
        dailyLimit: 50,
        recipientName: 'Limited User',
        recipientEmail: 'limited@example.com',
        customContext: 'This is a test reflink with limited features for testing purposes.',
        tokenLimit: 10000,
        spendLimit: 10.00,
        enableVoiceAI: false,
        enableJobAnalysis: true,
        enableAdvancedNavigation: false,
        isActive: true,
      },
    });

    console.log('\n✅ Limited test reflink created successfully:');
    console.log(`   Code: ${limitedReflink.code}`);
    console.log(`   Name: ${limitedReflink.name}`);
    console.log(`   Recipient: ${limitedReflink.recipientName}`);
    console.log(`   Features: Job Analysis only`);
    console.log(`   Budget: $${limitedReflink.spendLimit} / ${limitedReflink.tokenLimit} tokens`);
    console.log(`   Test URL: http://localhost:3000/test-reflink?ref=${limitedReflink.code}`);

    // Create an expired reflink for testing
    const expiredReflink = await prisma.aIReflink.create({
      data: {
        code: 'test-expired',
        name: 'Test Expired Access',
        description: 'Test reflink that is expired',
        rateLimitTier: 'STANDARD',
        dailyLimit: 50,
        recipientName: 'Expired User',
        recipientEmail: 'expired@example.com',
        customContext: 'This reflink has expired for testing purposes.',
        expiresAt: new Date('2024-01-01'), // Past date
        enableVoiceAI: true,
        enableJobAnalysis: true,
        enableAdvancedNavigation: true,
        isActive: true,
      },
    });

    console.log('\n✅ Expired test reflink created successfully:');
    console.log(`   Code: ${expiredReflink.code}`);
    console.log(`   Name: ${expiredReflink.name}`);
    console.log(`   Status: Expired (${expiredReflink.expiresAt})`);
    console.log(`   Test URL: http://localhost:3000/test-reflink?ref=${expiredReflink.code}`);

    console.log('\n🎉 All test reflinks created successfully!');
    console.log('\nYou can now test the reflink detection functionality:');
    console.log('1. Premium access: http://localhost:3000/test-reflink?ref=test-premium');
    console.log('2. Limited access: http://localhost:3000/test-reflink?ref=test-limited');
    console.log('3. Expired reflink: http://localhost:3000/test-reflink?ref=test-expired');
    console.log('4. Invalid reflink: http://localhost:3000/test-reflink?ref=invalid-code');
    console.log('5. No reflink (public): http://localhost:3000/test-reflink');

  } catch (error) {
    console.error('❌ Failed to create test reflinks:', error);
    
    if (error.code === 'P2002') {
      console.log('\n💡 Test reflinks may already exist. Try deleting them first:');
      console.log('   DELETE FROM ai_reflinks WHERE code LIKE \'test-%\';');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestReflink();