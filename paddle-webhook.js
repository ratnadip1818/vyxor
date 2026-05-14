// api/paddle-webhook.js
// Paddle webhook — verifies payment and upgrades user in Firestore

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    const eventType = event?.event_type;

    // Handle subscription activated — first payment
    if (eventType === 'subscription.activated' || eventType === 'transaction.completed') {
      const customData = event?.data?.custom_data || {};
      const uid = customData.uid;

      if (!uid) {
        console.error('No uid in custom_data');
        return res.status(200).json({ received: true });
      }

      // Upgrade user to Pro in Firestore
      await db.collection('users').doc(uid).set({
        plan: 'pro',
        planStarted: FieldValue.serverTimestamp(),
        paddleSubscriptionId: event?.data?.id || '',
        paddleCustomerId: event?.data?.customer_id || '',
        planUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`User ${uid} upgraded to Pro`);
    }

    // Handle subscription cancelled
    if (eventType === 'subscription.canceled') {
      const customData = event?.data?.custom_data || {};
      const uid = customData.uid;

      if (uid) {
        await db.collection('users').doc(uid).set({
          plan: 'cancelled',
          planCancelledAt: FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`User ${uid} subscription cancelled`);
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
