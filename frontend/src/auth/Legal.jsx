/**
 * auth/Legal.jsx
 * Privacy Policy and Terms of Service.
 */

function LegalHeading({ children }) {
  return <div style={{ fontWeight:700, color:"var(--ink-0)", fontSize:14, marginTop:20, marginBottom:6 }}>{children}</div>;
}
function LegalP({ children }) {
  return <p style={{ margin:"0 0 10px", color:"var(--ink-1)" }}>{children}</p>;
}

function PrivacyPolicy() {
  return (
    <div>
      <LegalP>This Privacy Policy describes how Ledgr ("we", "us", or "our") collects, uses, and protects your information when you use ledgrfinance.app.</LegalP>

      <LegalHeading>1. Information We Collect</LegalHeading>
      <LegalP><strong>Account information:</strong> When you register, we collect your email address and a hashed version of your password. We never store your password in plain text.</LegalP>
      <LegalP><strong>Financial data:</strong> If you connect a bank account, we use Plaid to retrieve transaction history and account balances. This data is stored in our database and associated with your account. We do not sell or share your financial data with third parties.</LegalP>
      <LegalP><strong>Manually entered data:</strong> Transactions, accounts, categories, budgets, and rules you create manually are stored in our database.</LegalP>
      <LegalP><strong>Payment information:</strong> Payments are processed by Stripe. We do not store your full card number or payment details — only a Stripe customer ID used to manage your subscription.</LegalP>
      <LegalP><strong>Usage data:</strong> We may collect basic server logs (IP address, request timestamps) for security and debugging purposes. We do not use third-party analytics trackers.</LegalP>

      <LegalHeading>2. How We Use Your Information</LegalHeading>
      <LegalP>We use your information to provide and improve the ledgr service, process payments, send transactional emails (welcome, trial expiry, password reset, subscription confirmations), and respond to support requests. We do not use your financial data for advertising.</LegalP>

      <LegalHeading>3. Bank Connection (Plaid)</LegalHeading>
      <LegalP>Bank connections are powered by Plaid Technologies, Inc. When you connect a bank account, you are also subject to Plaid's Privacy Policy (plaid.com/legal). We store your Plaid access token in encrypted form. You can disconnect a bank account at any time from the Accounts page, which removes the connection and associated data.</LegalP>

      <LegalHeading>4. Data Storage and Security</LegalHeading>
      <LegalP>Your data is stored in a PostgreSQL database hosted on Neon. Plaid access tokens are encrypted at rest using AES-256. We use HTTPS for all data in transit. We take reasonable steps to protect your data but cannot guarantee absolute security.</LegalP>

      <LegalHeading>5. Data Retention and Deletion</LegalHeading>
      <LegalP>Your data is retained for as long as your account is active. You can delete all your data at any time from Settings ← Your Data ← Clear All Data. You can also delete your account by contacting us at support@ledgrfinance.app, which will permanently remove all your data within 30 days.</LegalP>

      <LegalHeading>6. Emails</LegalHeading>
      <LegalP>We send transactional emails only (welcome, password reset, subscription events, trial expiry warnings). We do not send marketing emails without your consent. You can opt out of non-essential emails by contacting support@ledgrfinance.app.</LegalP>

      <LegalHeading>7. Third-Party Services</LegalHeading>
      <LegalP>We use the following third-party services: Plaid (bank connectivity), Stripe (payment processing), Resend (transactional email), Neon (database hosting), Railway (backend hosting), and Vercel (frontend hosting). Each has their own privacy policy.</LegalP>

      <LegalHeading>8. Children's Privacy</LegalHeading>
      <LegalP>Ledgr is not intended for users under the age of 18. We do not knowingly collect information from minors.</LegalP>

      <LegalHeading>9. Changes to This Policy</LegalHeading>
      <LegalP>We may update this Privacy Policy from time to time. We will notify you of significant changes via email. Continued use of the service after changes constitutes acceptance of the updated policy.</LegalP>

      <LegalHeading>10. Contact</LegalHeading>
      <LegalP>If you have questions about this Privacy Policy, contact us at support@ledgrfinance.app.</LegalP>
    </div>
  );
}

function TermsOfService() {
  return (
    <div>
      <LegalP>These Terms of Service ("Terms") govern your use of ledgrfinance.app, operated by Ledgr ("we", "us", or "our"). By using Ledgr, you agree to these Terms.</LegalP>

      <LegalHeading>1. Eligibility</LegalHeading>
      <LegalP>You must be at least 18 years old to use Ledgr. By creating an account, you represent that you meet this requirement and that the information you provide is accurate.</LegalP>

      <LegalHeading>2. Your Account</LegalHeading>
      <LegalP>You are responsible for maintaining the security of your account password and for all activity that occurs under your account. Notify us immediately at support@ledgrfinance.app if you suspect unauthorized access.</LegalP>

      <LegalHeading>3. Subscription and Billing</LegalHeading>
      <LegalP>Ledgr is offered on a subscription basis at $4.99 per month following a 7-day free trial. Subscriptions automatically renew each month unless canceled. You may cancel at any time from Settings ← Subscription ← Manage Subscription. Cancellation takes effect at the end of the current billing period — no partial refunds are provided for unused time.</LegalP>
      <LegalP>Payments are processed by Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis.</LegalP>

      <LegalHeading>4. Free Trial</LegalHeading>
      <LegalP>New accounts receive a 7-day free trial with full access to all features. At the end of the trial, a subscription is required to continue using write features and bank connections. Your data remains accessible in read-only mode without a subscription.</LegalP>

      <LegalHeading>5. Acceptable Use</LegalHeading>
      <LegalP>You agree not to use Ledgr to: violate any laws or regulations, attempt to gain unauthorized access to our systems, reverse engineer or scrape the service, or use the service for any purpose other than personal financial tracking.</LegalP>

      <LegalHeading>6. Financial Data Disclaimer</LegalHeading>
      <LegalP>Ledgr is a personal finance tracking tool. It does not provide financial advice, investment recommendations, or tax guidance. Transaction data imported from banks may contain errors or delays. Always verify important financial information with your financial institution directly.</LegalP>

      <LegalHeading>7. Bank Connections</LegalHeading>
      <LegalP>Bank connectivity is provided by Plaid Technologies, Inc. By connecting a bank account, you agree to Plaid's End User Privacy Policy. We are not responsible for errors, outages, or data discrepancies caused by Plaid or your financial institution.</LegalP>

      <LegalHeading>8. Data and Privacy</LegalHeading>
      <LegalP>Your use of Ledgr is also governed by our Privacy Policy. We take reasonable steps to protect your data but cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.</LegalP>

      <LegalHeading>9. Service Availability</LegalHeading>
      <LegalP>We strive to maintain high availability but do not guarantee uninterrupted access to the service. We may perform maintenance, updates, or experience outages that temporarily affect availability. We are not liable for any losses resulting from service interruptions.</LegalP>

      <LegalHeading>10. Termination</LegalHeading>
      <LegalP>You may close your account at any time by contacting support@ledgrfinance.app. We reserve the right to suspend or terminate accounts that violate these Terms. Upon termination, your data will be deleted within 30 days.</LegalP>

      <LegalHeading>11. Limitation of Liability</LegalHeading>
      <LegalP>To the maximum extent permitted by law, Ledgr shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to loss of data, financial losses, or interruption of service.</LegalP>

      <LegalHeading>12. Disclaimer of Warranties</LegalHeading>
      <LegalP>Ledgr is provided "as is" without warranties of any kind, express or implied. We do not warrant that the service will be error-free, secure, or continuously available.</LegalP>

      <LegalHeading>13. Governing Law</LegalHeading>
      <LegalP>These Terms are governed by the laws of the State of Minnesota, United States, without regard to its conflict of law provisions.</LegalP>

      <LegalHeading>14. Changes to Terms</LegalHeading>
      <LegalP>We may update these Terms from time to time. We will notify you of material changes via email. Continued use of the service after changes constitutes acceptance of the updated Terms.</LegalP>

      <LegalHeading>15. Contact</LegalHeading>
      <LegalP>Questions about these Terms? Contact us at support@ledgrfinance.app.</LegalP>
    </div>
  );
}

export { PrivacyPolicy, TermsOfService };
