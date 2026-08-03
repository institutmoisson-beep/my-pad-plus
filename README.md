# Home Harmony Hub

Create a mobile-first, premium real estate and rent management web application named "Imo MSN".

### 1. DESIGN & BRANDING DIRECTION
- **Name:** "Imo MSN" (Generate a modern, sleek minimalist logo with a building + wallet/check icon in white and emerald gold).
- **Style:** Pure Premium Peace theme. Ultra-clean, modern Android native app layout.
- **Color Palette:**
  - Primary: Deep Royal Navy `#0F172A`
  - Secondary/Accents: Sky Blue `#0EA5E9` & Emerald Success `#10B981`
  - Backgrounds: Pure White `#FFFFFF` & Ultra-light Gray `#F8FAFC`
- **UI Structure:** NO marketing homepage. The app goes straight to Auth (Login/Register) or directly to the App Dashboard with a fixed **Bottom Navigation Bar** with smooth icons:
  - For Users/Tenants: [Accueil], [Loyer], [Portefeuille], [Chat], [Profil]
  - For Landlords: [Accueil], [Mes Biens], [Portefeuille], [Chat], [Profil]
  - For Admin: Top navigation or drawer for Management Panel.

---

### 2. AUTHENTICATION, PIN & BIOMETRIC SECURITY
- **Account Registration:**
  - Users sign up with Email/Phone, Full Name, Password, and **MUST define a 4-digit PIN code**.
- **Flexible Login Options:**
  1. *Password Login:* Standard email/phone + password authentication.
  2. *Quick 4-Digit PIN Login:* Fast 4-box numeric keypad entry for instant access.
  3. *Biometric / Fingerprint Login:* WebAuthn / Biometric API support ("Se connecter avec l'empreinte digitale"). On first PIN/Password login, prompt user to enable Fingerprint authentication for future quick access.
- **Security Settings in Profile:** Users and Landlords can enable/disable Biometric login, update their 4-digit PIN code, or change their password at any time.

---

### 3. BIDIRECTIONAL TENANT-LANDLORD LINKING & DYNAMIC ROLES
- Auth system using Supabase Auth (Email, Phone number, Password).
- User Roles: `admin`, `landlord`, `user` (default), `tenant`.
- **Bidirectional Linking Engine:**
  - **Option A (Landlord initiates):** Landlord searches for a registered user by Name, Email, or Phone Number and assigns them to one of their properties.
  - **Option B (User/Tenant initiates):** A regular user can click "Rechercher mon propriétaire" from their dashboard, enter the Landlord's Name, Email, or Phone Number.
    - If found, the user sees the Landlord's listed available properties.
    - The user selects the property they occupy and clicks "Revendiquer comme locataire".
    - Automatically or upon validation, the property is linked to the user.
  - **Role Activation & Notifications:**
    - The user's role automatically elevates to include `tenant`, and the "Loyer" button/tab immediately appears on their bottom bar.
    - The Landlord receives an immediate push notification + sound alert + in-app message stating: *"Un nouveau locataire [Nom du locataire] s'est associé à votre bien [Nom du bien]"*.

---

### 4. LANDLORD FEATURES (GESTION PROPRIÉTAIRE)
- **Add/Manage Properties:**
  - Property Types dropdown: Studio, Studio américain, 2 pièces, 3 pièces, 4 pièces, Villa, Villa avec piscine, Appartement 1 pièce, Appartement 2 pièces, Appartement 3 pièces, Magasin, Bureau, Autre.
  - Fields: Name/Code of Property, Rent Amount (e.g. in FCFA/XOF), Monthly Due Date (e.g., 5th or 30th of every month), City, District/Quartier, Address details, Description, Photos.
- **Manage Tenants:** View associated tenants per property, unlink tenants, or view tenant payment progress.

---

### 5. TENANT & RENT PAYMENT SYSTEM (FLEXIBLE PAYMENTS)
- **"Loyer" (Rent) Dashboard for Tenants:**
  - Shows all assigned properties (grouped by property or landlord).
  - Displays: Total Monthly Rent, Total Amount Paid so far, Remaining Balance, Next Due Date, and a Progress Bar (0% to 100%).
  - **3 Payment Modes Options:**
    1. *Paiement Séquentiel Variable (Libre):* Tenant enters any amount whenever they want (e.g. 1,000 FCFA today, 500 FCFA tomorrow, 28,500 FCFA on due date).
    2. *Paiement Séquentiel Quotidien Fixe:* Calculates `(Remaining Rent / Days left until due date)` and lets tenant pay daily.
    3. *Paiement Total à l'échéance:* Pay the 100% balance in one single click on or before the due date.
- **Payment Execution:**
  - Payments deduct money directly from the Tenant's **Internal Wallet** and credit the Landlord's **Internal Wallet** in real-time.
  - Generates an instant digital receipt PDF / downloadable view.

---

### 6. WALLET & CHECKOUT SYSTEM (PORTEFEUILLE & RECHARGEMENT/RETRAIT)
- **Tenant & Landlord Wallets:**
  - Balance display (e.g., "Solde Imo Wallet: 45,000 FCFA").
  - Transaction History tab: All deposits, rent deductions, received payments, and withdrawals with status badges (Pending, Approved, Rejected).
- **Deposit / Wallet Recharge (Checkout Manuel Admin):**
  - Tenant clicks "Recharger mon portefeuille".
  - Shows payment methods configured by Admin (Mobile Money: Wave, Orange, MTN, Moov; Bank Transfer details; Crypto Address BTC/USDT).
  - Tenant enters deposit amount, uploads transaction screenshot/reference code, and submits.
  - Admin receives request, verifies, and clicks "Approuver" $\rightarrow$ User's wallet balance increases instantly.
- **Landlord Withdrawal (Demande de Retrait):**
  - Landlords can request a withdrawal.
  - Option to save payout preferences: Network (Orange, Moov, MTN, Wave, Bank IBAN, Crypto USDT address) and Account details.
  - Landlord inputs amount to withdraw. System calculates and displays **Withdrawal Fees** (configured by Admin).
  - Admin reviews request, performs manual payout, and clicks "Valider le retrait" $\rightarrow$ Debits the Landlord's wallet balance and logs transaction.

---

### 7. REAL-TIME CHAT & SOUND NOTIFICATION CENTER
- **In-App Messaging:**
  - Direct 1-on-1 messaging channel strictly between a Landlord and their assigned Tenant(s).
  - Supports: Text messages, Image upload, Document attach, and Voice Notes recording (Web Audio API / MediaRecorder).
- **Notification System:**
  - Sound effect (short notification chime) whenever a user receives a message or payment notification while connected.
  - In-app notification center (Bell icon with badge counter).
  - Triggers: Property assignment/self-association, Rent payment received, Deposit approved/rejected, Withdrawal approved, New chat message.

---

### 8. SUPER ADMIN PANEL
- Manage all users, landlords, tenants, and properties.
- **Checkout & Deposit Requests:** Review, approve, or reject user wallet top-ups.
- **Withdrawal Requests:** Review landlord payouts, view payout details, apply configurable withdrawal fee percentage (e.g. 1.5% or fixed amount), approve or reject.
- **System Config:** Update Admin payment methods (Mobile Money numbers, Bank IBAN, Crypto addresses) and global fee rates.

---

### 9. TECH STACK & REQUIREMENTS
- Frontend: React + Vite + Tailwind CSS + Lucide Icons + Shadcn UI + Framer Motion.
- Biometric Security: `@simplewebauthn/browser` or WebAuthn Native Browser API.
- Backend/Database: Supabase (Auth, Postgres, Realtime Subscriptions, Storage buckets for photos & audio voice notes).
- Audio: HTML5 Web Audio API for recording and custom sound player for notifications.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b5fb31b4-e3ba-4837-8095-a0f1dfb50e6a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
