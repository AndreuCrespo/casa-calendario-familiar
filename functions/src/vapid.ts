// npm run vapid → genera un par de claves VAPID para las notificaciones push.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('Clave pública  (VITE_VAPID_PUBLIC_KEY en .env.local y VAPID_PUBLIC_KEY al desplegar):');
console.log(`  ${publicKey}`);
console.log('Clave privada  (solo en: firebase functions:secrets:set VAPID_PRIVATE_KEY):');
console.log(`  ${privateKey}`);
console.log('\nNo guardes la privada en ningún archivo del repositorio.');
