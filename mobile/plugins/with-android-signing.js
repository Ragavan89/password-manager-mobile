const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to configure Android release signing
 * 
 * This plugin reads keystore credentials from a keystore.properties file
 * and configures the release signing config in build.gradle
 */
const fs = require('fs');
const path = require('path');

const withAndroidSigning = (config) => {
    return withAppBuildGradle(config, (config) => {
        // Strategy: Detect Environment based on EAS_BUILD flag
        // 'npm run build:prod' -> Runs on EAS Cloud -> EAS_BUILD is 'true' -> We SKIP local signing
        // 'npm run build:local' -> Runs Locally -> EAS_BUILD is undefined -> We APPLY local signing

        if (process.env.EAS_BUILD) {
            console.log('Environment: EAS Cloud (Production) - Skipping local signing injection to avoid conflicts.');
            return config;
        }

        // Verify keystore exists for local build
        const projectRoot = config.modRequest.projectRoot;
        const keystorePath = path.join(projectRoot, 'keystore', 'keystore.properties');
        if (!fs.existsSync(keystorePath)) {
            console.warn('⚠️ Warning: Local build detected but keystore.properties not found at: ' + keystorePath);
            console.warn('Signing config will NOT be applied. Build may fail if signing is required.');
            return config;
        }

        console.log('Environment: Local Build - Injecting local signing config from keystore.properties.');

        if (config.modResults.language === 'groovy') {
            config.modResults.contents = configureSigningConfig(config.modResults.contents);
        }
        return config;
    });
};

function configureSigningConfig(buildGradle) {
    // The release signing config to add
    const releaseSigningConfig = `
        release {
            def keystorePropertiesFile = rootProject.file("keystore.properties")
            def keystoreProperties = new Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`;

    // Step 1: Add release config to existing signingConfigs block
    // Check if signingConfigs exists but doesn't have a release config
    if (buildGradle.includes('signingConfigs {') && !buildGradle.includes('signingConfigs.release')) {
        // Find the signingConfigs block and add release after the opening brace
        buildGradle = buildGradle.replace(
            /(signingConfigs\s*\{)(\s*\n)/,
            `$1$2${releaseSigningConfig}\n`
        );
    } else if (!buildGradle.includes('signingConfigs {')) {
        // No signingConfigs block exists, create one before buildTypes
        const fullSigningConfigs = `
    signingConfigs {${releaseSigningConfig}
    }

`;
        buildGradle = buildGradle.replace(
            /(\s+)(buildTypes\s*\{)/,
            `$1${fullSigningConfigs.trim()}\n\n$1$2`
        );
    }

    // Step 2: Add signingConfig to release buildType inside buildTypes block
    // We need to find "release {" that comes AFTER "buildTypes {"

    const buildTypesStart = buildGradle.indexOf('buildTypes {');
    if (buildTypesStart !== -1) {
        // Find "release {" after buildTypes
        const afterBuildTypes = buildGradle.substring(buildTypesStart);
        const releaseMatch = afterBuildTypes.match(/(\n\s+)(release\s*\{)/);

        if (releaseMatch) {
            const releaseStartIndex = buildTypesStart + releaseMatch.index + releaseMatch[1].length;
            const releaseBlockStart = releaseStartIndex + releaseMatch[2].length;

            // Find the end of the release block (simple brace counting)
            let braceCount = 1;
            let releaseBlockEnd = -1;
            for (let i = releaseBlockStart; i < buildGradle.length; i++) {
                if (buildGradle[i] === '{') braceCount++;
                else if (buildGradle[i] === '}') braceCount--;

                if (braceCount === 0) {
                    releaseBlockEnd = i;
                    break;
                }
            }

            if (releaseBlockEnd !== -1) {
                const releaseContent = buildGradle.substring(releaseBlockStart, releaseBlockEnd);

                // Check if we need to replace debug config or add release config
                let newReleaseContent = releaseContent;

                if (newReleaseContent.includes('signingConfig signingConfigs.debug')) {
                    newReleaseContent = newReleaseContent.replace(
                        'signingConfig signingConfigs.debug',
                        'signingConfig signingConfigs.release'
                    );
                } else if (!newReleaseContent.includes('signingConfig signingConfigs.release')) {
                    newReleaseContent = `\n            signingConfig signingConfigs.release` + newReleaseContent;
                }

                // Only update if changed
                if (newReleaseContent !== releaseContent) {
                    buildGradle = buildGradle.substring(0, releaseBlockStart) +
                        newReleaseContent +
                        buildGradle.substring(releaseBlockEnd);
                }
            }
        }
    }

    return buildGradle;
}

module.exports = withAndroidSigning;

