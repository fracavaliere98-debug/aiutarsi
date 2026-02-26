const { Jimp } = require('jimp');

async function removeBackground() {
    try {
        const image = await Jimp.read('./assets/images/logo.png');

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];

            if (red > 240 && green > 240 && blue > 240) {
                this.bitmap.data[idx + 3] = 0;
            }
        });

        await image.write('./assets/images/logo-transparent.png');
        console.log('Successfully created logo-transparent.png');
    } catch (error) {
        console.error('Error processing image:', error);
    }
}

removeBackground();
