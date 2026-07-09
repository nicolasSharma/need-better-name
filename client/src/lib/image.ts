/**
 * Compresses an image file from an <input type="file"> to a Base64 JPEG data URL.
 * Resizes the image to a max width/height to save database space.
 */
export async function compressImage(file: File, maxSize = 800, quality = 0.6): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = (event) => {
			const img = new Image();
			img.src = event.target?.result as string;
			img.onload = () => {
				const canvas = document.createElement('canvas');
				let width = img.width;
				let height = img.height;

				if (width > height) {
					if (width > maxSize) {
						height *= maxSize / width;
						width = maxSize;
					}
				} else {
					if (height > maxSize) {
						width *= maxSize / height;
						height = maxSize;
					}
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) return reject('Failed to get canvas context');

				ctx.drawImage(img, 0, 0, width, height);
				const dataUrl = canvas.toDataURL('image/jpeg', quality);
				resolve(dataUrl);
			};
			img.onerror = (error) => reject(error);
		};
		reader.onerror = (error) => reject(error);
	});
}
