const { Jimp } = require('jimp');

async function createIcons() {
    try {
        const logoTransp = await Jimp.read('./assets/images/logo-transparent.png');

        // Scale up the logo (using Nearest Neighbor or Bilinear, Expo might blur it anyway, but let's make it 800x800)
        logoTransp.resize({ w: 800, h: 800 });

        // 1. Main Icon (1024x1024) with white background
        const whiteBg = new Jimp({ width: 1024, height: 1024, color: '#FFFFFF' });
        whiteBg.composite(logoTransp, 112, 112); // Center: (1024-800)/2
        await whiteBg.write('./assets/images/icon.png');
        console.log('Created icon.png');

        // 2. Android Adaptive Foreground (1080x1080) - transparent background
        const transparentBg = new Jimp({ width: 1080, height: 1080, color: 0x00000000 });
        transparentBg.composite(logoTransp, 140, 140); // Center: (1080-800)/2
        await transparentBg.write('./assets/images/android-icon-foreground.png');
        console.log('Created android-icon-foreground.png');

        // 3. Splash Icon (let's say 800x800 transparent)
        // The previous was 200px width in app.json, let's keep logo as splash icon
        await logoTransp.write('./assets/images/splash-icon.png');
        console.log('Created splash-icon.png');

        // 4. Favicon (48x48)
        const favicon = await Jimp.read('./assets/images/logo-transparent.png');
        favicon.resize({ w: 48, h: 48 });
        await favicon.write('./assets/images/favicon.png');
        console.log('Created favicon.png');

        console.log('All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
    }
}

createIcons();
