import { Coordinates } from '../types';

// Haversine formula to calculate distance between two points in km
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(coord2.latitude - coord1.latitude);
  const dLon = deg2rad(coord2.longitude - coord1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(coord1.latitude)) *
    Math.cos(deg2rad(coord2.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(1)); // Return to 1 decimal place
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,") for Gemini
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const getFullDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

export const compressImage = (file: File, maxWidth = 800, quality = 0.7, targetSizeKB = 150): Promise<File> => {
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

        // Scale down to maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context unsupported');

        ctx.drawImage(img, 0, 0, width, height);

        // 检测 WebP 支持，回退到 JPEG
        const useWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const mimeType = useWebP ? 'image/webp' : 'image/jpeg';
        const ext = useWebP ? 'webp' : 'jpg';

        // Progressive quality reduction to hit target size
        const tryCompress = (q: number) => {
          canvas.toBlob((blob) => {
            if (!blob) return reject('Compression failed');

            const sizeKB = blob.size / 1024;
            if (sizeKB > targetSizeKB && q > 0.3) {
              tryCompress(q - 0.1);
              return;
            }

            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), {
              type: mimeType,
              lastModified: Date.now(),
            });

            const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(0);
            console.log(
              `[Compress] ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${reduction}% reduction, q=${q.toFixed(1)}, ${width}x${height}, ${ext})`
            );

            resolve(compressedFile);
          }, mimeType, q);
        };

        tryCompress(quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
