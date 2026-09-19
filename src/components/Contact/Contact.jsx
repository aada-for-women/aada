import './Contact.css';

const contactLinks = [
  {
    type: 'instagram',
    label: 'aada.forwomen',
    href: 'https://www.instagram.com/aada.forwomen?stkn=MWZrOG9yNWthdDhxdg=='
  },
  {
    type: 'email',
    label: 'aadaforwomen2026@gmail.com',
    href: 'mailto:aadaforwomen2026@gmail.com'
  }
];

function ContactIcon({ type }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };

  switch (type) {
    case 'instagram':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" />
        </svg>
      );
    case 'email':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Contact() {
  return (
    <section className="contact-section">
      <div className="contact-copy">
        <h2 className="contact-title">Contact Us</h2>

        <p className="contact-description">
          If you have any questions or inquiries, please contact us via email or instagram. 
          We will be very happy to help you!
        </p>

        <div className="contact-actions">
          {contactLinks.map((item) => (
            <a
              key={item.type}
              href={item.href}
              target={item.type === 'instagram' ? '_blank' : undefined}
              rel={item.type === 'instagram' ? 'noreferrer' : undefined}
              className="contact-link"
              aria-label={item.label}
            >
              <span className="contact-icon">
                <ContactIcon type={item.type} />
              </span>
              <span className="contact-tooltip">{item.label}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="contact-visual">
        <div className="contact-photo-card">
          <img src="/contact.png" alt="Customer on the phone" />
        </div>
      </div>
    </section>
  );
}