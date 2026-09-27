import { useEffect } from "react";
import { Link } from "react-router-dom";
import BrandName from "./BrandName";
import LegalLinks from "./LegalLinks";
import "./legal.css";

const CONTACT_EMAIL = "jon.emas.16@gmail.com";

function ContactLink({ subject }) {
  return <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}>{CONTACT_EMAIL}</a>;
}

function PrivacyPolicy() {
  return (
    <>
      <p className="legal-lede">
        This Privacy Policy explains how <BrandName /> collects, uses, stores, and shares
        information when people use our customer-feedback, reporting, roadmap, and social
        publishing services.
      </p>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account information:</strong> name, email address, login and security information.</li>
          <li><strong>Organization information:</strong> business names, locations, team memberships, public links, and configuration choices.</li>
          <li><strong>Feedback and content:</strong> customer submissions, reports, initiatives, social captions, images, and other material supplied through the service.</li>
          <li><strong>Social account information:</strong> account identifiers, usernames, profile details, granted permissions, token expiration information, and encrypted access tokens received through Meta, Instagram, or other providers.</li>
          <li><strong>Technical information:</strong> IP address, browser and device details, request logs, and security or diagnostic events.</li>
          <li><strong>Communications:</strong> messages sent to us for support, data requests, or other questions.</li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>We use information to:</p>
        <ul>
          <li>provide, maintain, personalize, and secure the service;</li>
          <li>authenticate users and manage organization and location access;</li>
          <li>collect feedback and create reports, summaries, and suggested content;</li>
          <li>connect social accounts and publish content only when an authorized user asks us to;</li>
          <li>send service communications and respond to support or data requests;</li>
          <li>detect abuse, troubleshoot problems, and comply with law.</li>
        </ul>
      </section>

      <section>
        <h2>Instagram and Meta data</h2>
        <p>
          When an organization connects an Instagram professional account, we use the permissions
          it grants to identify the account and publish content selected by an authorized user. We
          store access tokens in encrypted form and do not sell Instagram or Meta user data. A
          connection can be removed from the organization&apos;s Social accounts settings.
        </p>
      </section>

      <section>
        <h2>How information is shared</h2>
        <p>We share information only as needed with:</p>
        <ul>
          <li>service providers that host, secure, email, analyze, or otherwise operate the service;</li>
          <li>AI providers when an authorized user requests an AI-assisted feature;</li>
          <li>social platforms when an authorized user connects an account or publishes content;</li>
          <li>professional advisers, authorities, or other parties when required to protect rights, safety, or comply with law;</li>
          <li>a successor in a merger, financing, acquisition, or sale of all or part of the service, subject to applicable safeguards.</li>
        </ul>
        <p>We do not sell personal information.</p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          We retain information while it is needed to provide the service, meet legal obligations,
          resolve disputes, and maintain security. Organization administrators can disconnect
          social accounts or delete an organization in the service. Anyone can also follow our
          <Link to="/data-deletion"> data-deletion instructions</Link>.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, export, restrict, or
          delete personal information. You may exercise a request by contacting us. We may need to
          verify your identity and authority before fulfilling it.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We use administrative, technical, and organizational safeguards designed to protect
          information. No method of transmission or storage is completely secure, so we cannot
          guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          The service is intended for businesses and is not directed to children under 13. We do
          not knowingly collect personal information from children under 13.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy and will post the revised effective date here. Questions or
          privacy requests can be sent to <ContactLink subject="five* privacy request" />.
        </p>
      </section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <p className="legal-lede">
        These Terms govern access to and use of <BrandName />. By creating an account or using the
        service, you agree to these Terms.
      </p>

      <section>
        <h2>Eligibility and authority</h2>
        <p>
          You must be able to form a binding agreement and, when acting for a business or other
          organization, have authority to accept these Terms and connect accounts on its behalf.
        </p>
      </section>

      <section>
        <h2>Accounts and access</h2>
        <p>
          You are responsible for accurate account information, safeguarding credentials, and all
          activity under your account. Organization administrators control invitations, roles,
          locations, connected destinations, and other organization settings.
        </p>
      </section>

      <section>
        <h2>Your content and responsibilities</h2>
        <p>
          You retain ownership of content you submit. You grant us a limited license to host,
          process, reproduce, and transmit that content only as needed to operate and improve the
          service. You are responsible for having the rights and permissions required for customer
          feedback, uploaded media, social content, and connected accounts.
        </p>
      </section>

      <section>
        <h2>Social integrations</h2>
        <p>
          Connecting a social account authorizes <BrandName /> to use the permissions granted by
          that account. We publish only content selected or scheduled by an authorized user.
          Social platforms are third-party services with their own terms, policies, availability,
          and enforcement decisions. You can disconnect an integration at any time.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You may not use the service to:</p>
        <ul>
          <li>break the law, infringe rights, deceive people, or distribute harmful or unlawful content;</li>
          <li>access accounts or data without authorization;</li>
          <li>interfere with security, availability, rate limits, or normal operation;</li>
          <li>reverse engineer or misuse the service except where law expressly permits it;</li>
          <li>send spam or publish content that violates a connected platform&apos;s rules.</li>
        </ul>
      </section>

      <section>
        <h2>AI-assisted features</h2>
        <p>
          AI-generated summaries, drafts, and suggestions may be incomplete or inaccurate. You are
          responsible for reviewing outputs before relying on or publishing them.
        </p>
      </section>

      <section>
        <h2>Service changes and termination</h2>
        <p>
          We may update, suspend, or discontinue features. We may restrict access for violations,
          security risks, or legal reasons. You may stop using the service, disconnect integrations,
          or request deletion at any time.
        </p>
      </section>

      <section>
        <h2>Disclaimers and liability</h2>
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis to the
          extent permitted by law. We disclaim implied warranties and are not responsible for
          third-party services. To the extent permitted by law, <BrandName /> will not be liable for
          indirect, incidental, special, consequential, exemplary, or punitive damages, or lost
          profits, revenues, data, or goodwill.
        </p>
      </section>

      <section>
        <h2>Governing law and contact</h2>
        <p>
          These Terms are governed by Louisiana law, without regard to conflict-of-law rules. For
          questions about these Terms, contact <ContactLink subject="five* terms question" />.
        </p>
      </section>
    </>
  );
}

function DataDeletion() {
  const confirmationCode = new URLSearchParams(window.location.search).get("confirmation_code");

  return (
    <>
      <p className="legal-lede">
        You can disconnect a social account or request deletion of information associated with
        your <BrandName /> account and organization.
      </p>

      {confirmationCode && (
        <section>
          <h2>Deletion request completed</h2>
          <p>
            The Instagram connection data covered by Meta&apos;s verified request has been removed
            from <BrandName />. Your confirmation code is <strong>{confirmationCode}</strong>.
          </p>
        </section>
      )}

      <section>
        <h2>Disconnect Instagram or another social account</h2>
        <ol>
          <li>Sign in to <BrandName />.</li>
          <li>Open the organization or location&apos;s <strong>Settings</strong>.</li>
          <li>Choose <strong>Social accounts</strong>.</li>
          <li>Select <strong>Disconnect</strong> beside the account.</li>
        </ol>
        <p>
          Disconnecting removes the stored connection credentials from <BrandName /> and stops new
          publishing through that connection. Content already published on Instagram, Facebook,
          or another platform must be managed on that platform.
        </p>
      </section>

      <section>
        <h2>Delete an organization</h2>
        <p>
          An organization administrator can open <strong>Settings</strong> and use the organization
          deletion control. This removes organization data governed by that control, subject to
          limited retention required for security, legal compliance, or dispute resolution.
        </p>
      </section>

      <section>
        <h2>Request deletion by email</h2>
        <p>
          Send a request to <ContactLink subject="five* data deletion request" /> with the subject
          &quot;five* data deletion request.&quot; Include the email address used with <BrandName />,
          the organization name, the connected Instagram username if applicable, and what you want
          deleted. Do not send passwords or access tokens.
        </p>
        <p>
          We will verify the requester&apos;s identity and authority, then delete or de-identify
          information as required by applicable law. We will confirm when the request has been
          processed or explain any information we must retain.
        </p>
      </section>

      <section>
        <h2>Revoke platform access</h2>
        <p>
          You may also revoke <BrandName /> from your Instagram or Meta account settings. When Meta
          sends a verified deauthorization or deletion callback, <BrandName /> removes the associated
          Instagram connection credentials and profile data. Use the steps above to request deletion
          of any other information.
        </p>
      </section>
    </>
  );
}

const PAGE_CONTENT = {
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    body: <PrivacyPolicy />,
  },
  terms: {
    eyebrow: "Legal",
    title: "Terms of Service",
    body: <TermsOfService />,
  },
  deletion: {
    eyebrow: "Your data",
    title: "Data-deletion instructions",
    body: <DataDeletion />,
  },
};

export default function LegalPage({ page }) {
  const content = PAGE_CONTENT[page] || PAGE_CONTENT.privacy;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${content.title} | five*`;
    return () => {
      document.title = previousTitle;
    };
  }, [content.title]);

  return (
    <article className="legal-page">
      <header className="legal-page-header">
        <p className="legal-eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="legal-effective">Effective August 3, 2026</p>
      </header>

      <div className="legal-page-body">{content.body}</div>

      <footer className="legal-page-footer">
        <Link className="legal-home-link" to="/">Return to five*</Link>
        <LegalLinks />
      </footer>
    </article>
  );
}
