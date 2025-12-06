const { withDangerousMod, withProjectBuildGradle } = require('@expo/config-plugins');

const withAgpFix = (config) => {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = setAgpVersion(config.modResults.contents);
        }
        return config;
    });
};

function setAgpVersion(buildGradle) {
    const pattern = /classpath\('com\.android\.tools\.build:gradle(:[0-9.]+)?'\)/;
    const replacement = "classpath('com.android.tools.build:gradle:8.7.3')";

    if (buildGradle.match(pattern)) {
        return buildGradle.replace(pattern, replacement);
    }
    return buildGradle;
}

module.exports = withAgpFix;
