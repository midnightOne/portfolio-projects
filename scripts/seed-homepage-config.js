#!/usr/bin/env node

/**
 * Seed script to ensure homepage configuration exists in database
 * Run this after database reset to prevent homepage errors
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultWaveConfig = {
    id: 'default',
    name: 'Default Wave',
    isActive: true,
    wavesX: 2.0,
    wavesY: 1.5,
    displacementHeight: 0.8,
    speedX: 0.002,
    speedY: 0.001,
    cylinderBend: 0.3,
    lightTheme: {
        primaryColor: '#6366f1',
        valleyColor: '#e0e7ff',
        peakColor: '#a855f7'
    },
    darkTheme: {
        primaryColor: '#4f46e5',
        valleyColor: '#1e1b4b',
        peakColor: '#7c3aed'
    },
    iridescenceWidth: 20.0,
    iridescenceSpeed: 0.005,
    flowMixAmount: 0.4,
    revealAnimationSpeed: 1.5,
    cameraPosition: { x: 0, y: 0, z: 5 },
    cameraRotation: { x: 0, y: 0, z: 0 },
    cameraZoom: 1.0,
    cameraTarget: { x: 0, y: 0, z: 0 }
};

const defaultSections = [
    {
        id: 'hero-main',
        type: 'hero',
        enabled: true,
        order: 1,
        config: {
            title: 'John Doe',
            subtitle: 'Full Stack Developer',
            description: 'Building digital experiences that make a difference.',
            theme: 'default',
            showScrollIndicator: true,
            ctaText: 'View My Work',
            ctaLink: '#projects',
            enableWaveBackground: true
        }
    },
    {
        id: 'about-main',
        type: 'about',
        enabled: true,
        order: 2,
        config: {
            content: 'I\'m a passionate developer with expertise in modern web technologies. I love creating solutions that are both functional and beautiful.',
            skills: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Next.js'],
            showSkills: true,
            theme: 'default',
            layout: 'side-by-side'
        }
    },
    {
        id: 'projects-main',
        type: 'projects',
        enabled: true,
        order: 3,
        config: {
            variant: 'homepage',
            config: {
                title: 'Featured Projects',
                description: 'A showcase of my recent work and projects',
                maxItems: 6,
                layout: 'grid',
                columns: 3,
                showSearch: false,
                showFilters: false,
                showSorting: false,
                showViewToggle: false,
                showViewCount: false,
                openMode: 'modal',
                spacing: 'normal',
                theme: 'default'
            }
        }
    },
    {
        id: 'contact-main',
        type: 'contact',
        enabled: true,
        order: 4,
        config: {
            title: 'Get In Touch',
            description: 'I\'m always interested in new opportunities and collaborations.',
            showContactForm: true,
            theme: 'default',
            socialLinks: []
        }
    }
];

async function seedHomepageConfig() {
    try {
        console.log('🌱 Seeding homepage configuration...');

        // Check if homepage config already exists
        console.log('🔍 Querying for existing config...');
        const existingConfig = await prisma.homepageConfig.findFirst({
            include: {
                sectionConfigs: true
            }
        });
        console.log('📊 Query completed, found config:', !!existingConfig);

        if (existingConfig) {
            console.log('✅ Homepage configuration already exists');
            console.log(`📊 Found ${existingConfig.sectionConfigs?.length || 0} section configs`);

            // Check if it has wave config
            let waveConfigUpdated = false;
            if (!existingConfig.waveConfig) {
                console.log('🌊 Adding wave configuration to existing homepage config...');
                await prisma.homepageConfig.update({
                    where: { id: existingConfig.id },
                    data: { waveConfig: defaultWaveConfig }
                });
                console.log('✅ Wave configuration added');
                waveConfigUpdated = true;
            } else {
                console.log('✅ Wave configuration already exists');
            }

            // Check if section configurations are missing
            const existingSectionIds = existingConfig.sectionConfigs.map(s => s.sectionId);
            const missingSections = defaultSections.filter(section =>
                !existingSectionIds.includes(section.id)
            );

            console.log(`📊 Current sections: ${existingSectionIds.join(', ') || 'none'}`);
            console.log(`📊 Expected sections: ${defaultSections.map(s => s.id).join(', ')}`);
            console.log(`📊 Missing sections: ${missingSections.map(s => s.id).join(', ') || 'none'}`);

            if (missingSections.length > 0) {
                console.log(`📄 Adding ${missingSections.length} missing section configurations...`);

                try {
                    await prisma.sectionConfig.createMany({
                        data: missingSections.map(section => ({
                            homepageConfigId: existingConfig.id,
                            sectionId: section.id,
                            type: section.type,
                            enabled: section.enabled,
                            order: section.order,
                            config: section.config
                        }))
                    });

                    // Also update the sections JSON field to include all sections
                    const allSections = [...existingConfig.sections, ...missingSections];
                    await prisma.homepageConfig.update({
                        where: { id: existingConfig.id },
                        data: { sections: allSections }
                    });

                    console.log('✅ Missing section configurations added');
                    console.log(`   - Added sections: ${missingSections.map(s => s.id).join(', ')}`);
                } catch (error) {
                    console.error('❌ Error adding missing sections:', error);
                    throw error;
                }
            } else {
                console.log('✅ All section configurations already exist');
            }

            if (waveConfigUpdated || missingSections.length > 0) {
                console.log('🎉 Homepage configuration updated successfully!');
            }

            return;
        }

        // Create new homepage configuration
        console.log('🏗️ Creating new homepage configuration...');

        const homepageConfig = await prisma.homepageConfig.create({
            data: {
                sections: defaultSections,
                globalTheme: 'default',
                layout: 'standard',
                waveConfig: defaultWaveConfig
            }
        });

        // Create section configs
        console.log('📄 Creating section configurations...');

        await prisma.sectionConfig.createMany({
            data: defaultSections.map(section => ({
                homepageConfigId: homepageConfig.id,
                sectionId: section.id,
                type: section.type,
                enabled: section.enabled,
                order: section.order,
                config: section.config
            }))
        });

        console.log('✅ Homepage configuration seeded successfully!');
        console.log(`   - Created homepage config with ID: ${homepageConfig.id}`);
        console.log(`   - Created ${defaultSections.length} section configurations`);
        console.log('   - Added default wave background configuration');

    } catch (error) {
        console.error('❌ Error seeding homepage configuration:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seeding function
if (require.main === module) {
    seedHomepageConfig()
        .then(() => {
            console.log('🎉 Seeding completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedHomepageConfig };