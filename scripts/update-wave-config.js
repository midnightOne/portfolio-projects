#!/usr/bin/env node

/**
 * Update existing wave configuration to include new fields
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateWaveConfig() {
  try {
    console.log('🔄 Updating wave configuration...');

    // Get the current homepage configuration
    const homepageConfig = await prisma.homepageConfig.findFirst();
    
    if (!homepageConfig) {
      console.log('❌ No homepage config found');
      return;
    }

    if (!homepageConfig.waveConfig) {
      console.log('❌ No wave config found');
      return;
    }

    // Check for missing fields and fix them
    const currentWaveConfig = homepageConfig.waveConfig;
    let needsUpdate = false;
    const updatedWaveConfig = { ...currentWaveConfig };

    // Add missing revealAnimationSpeed
    if (currentWaveConfig.revealAnimationSpeed === undefined) {
      console.log('➕ Adding missing revealAnimationSpeed field...');
      updatedWaveConfig.revealAnimationSpeed = 1.5;
      needsUpdate = true;
    }

    // Fix camera rotation to include z component
    if (!currentWaveConfig.cameraRotation || currentWaveConfig.cameraRotation.z === undefined) {
      console.log('➕ Adding missing cameraRotation.z field...');
      updatedWaveConfig.cameraRotation = {
        x: currentWaveConfig.cameraRotation?.x || 0,
        y: currentWaveConfig.cameraRotation?.y || 0,
        z: 0 // Default z rotation
      };
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.homepageConfig.update({
        where: { id: homepageConfig.id },
        data: {
          waveConfig: updatedWaveConfig,
          updatedAt: new Date()
        }
      });

      console.log('✅ Wave configuration updated successfully!');
    } else {
      console.log('✅ Wave configuration already has all required fields');
    }

  } catch (error) {
    console.error('❌ Error updating wave configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update function
if (require.main === module) {
  updateWaveConfig()
    .then(() => {
      console.log('🎉 Update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateWaveConfig };