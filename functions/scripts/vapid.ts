// npm run vapid → generates a VAPID key pair for push notifications.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('Public key   (VITE_VAPID_PUBLIC_KEY in .env.local and VAPID_PUBLIC_KEY when deploying):');
console.log(`  ${publicKey}`);
console.log('Private key  (only in: firebase functions:secrets:set VAPID_PRIVATE_KEY):');
console.log(`  ${privateKey}`);
console.log('\nNever store the private key in any file in the repository.');
