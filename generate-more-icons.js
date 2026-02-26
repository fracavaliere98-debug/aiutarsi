const { Jimp } = require('jimp');

async function createMoreIcons() {
    try {
        const logoTransp = await Jimp.read('./assets/images/logo-transparent.png');
        logoTransp.resize({ w: 800, h: 800 });

        // 5. Android Adaptive Background (1080x1080) - Solid color like #f8fafc (Landing page background)
        const bg = new Jimp({ width: 1080, height: 1080, color: '#f8fafc' });
        await bg.write('./assets/images/android-icon-background.png');
        console.log('Created android-icon-background.png');

        // 6. Monochrome icon (1080x1080) - Needs to be pure white where logo is visible, transparent elsewhere
        // We can iterate over the pixels of the transparent foreground and make them white
        const monochrome = new Jimp({ width: 1080, height: 1080, color: 0x00000000 });
        monochrome.composite(logoTransp, 140, 140);

        monochrome.scan(0, 0, monochrome.bitmap.width, monochrome.bitmap.height, function (x, y, idx) {
            const alpha = this.bitmap.data[idx + 3];
            if (alpha > 0) {
                // pure white
                this.bitmap.data[idx + 0] = 255;
                this.bitmap.data[idx + 1] = 255;
                this.bitmap.data[idx + 2] = 255;
            }
        });

        await monochrome.write('./assets/images/android-icon-monochrome.png');
        console.log('Created android-icon-monochrome.png');

        console.log('Extra icons generated!');
    } catch (error) {
        console.error('Error generating icons:', error);
    }
}

createMoreIcons();
