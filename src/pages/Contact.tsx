import { useState } from 'react';
import { Building2, FileText, Globe2, Mail, MapPin, MessageSquare, Monitor, Phone, Send, Users } from 'lucide-react';
import { CTAButton, ContactCard, Eyebrow } from '../components/SiteChrome';
import { DustMap } from '../components/Visuals';
import { siteConfig } from '../data/site';
import { submitContactMessage, type ContactPayload } from '../services/contactService';

const initialForm: ContactPayload = { name: '', organization: '', email: '', subject: '', message: '' };

function WorldMap() {
  return <div className="world-map" aria-label="Illustrative global impact map"><svg viewBox="0 0 600 300" role="img" aria-hidden="true">
    <defs><pattern id="worldDots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.8" cy="1.8" r="1.4" fill="#087ca1" opacity=".75" /></pattern><filter id="mapGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <path fill="url(#worldDots)" d="M32 71l23-16 25 4 20-11 22 11 23-2 18 14-7 16-19 2-10 18-21 7-8 21-19 9-11-20-19-3-9-18-20-5-9-15zM138 152l19-3 15 12 6 26-7 20 11 19-9 32-13-4-7-25-16-11-8-25-11-20zM240 63l26-13 27 6 20-11 37 9 10 18 26 1 20 15-11 14-30-7-15 15-23-7-17 12-26-10-19 7-19-17-24-6-9-17zM273 127l26-10 32 10 19 20 13 35-18 32-16 26-21-7-15-29-13-16-21-13-5-26zM371 179l30-11 25 10 11 22-14 18-33-1-14-14zM471 99l13-19 18 7 8 15-11 12-20-1z" />
    <path className="world-route" d="M105 111 Q218 25 317 93 T491 118 M105 111 Q208 208 316 154 T490 117 M155 82 Q251 128 371 84" />
    <g filter="url(#mapGlow)"><circle className="world-dot" cx="104" cy="111" r="5"/><circle className="world-dot" cx="286" cy="86" r="5"/><circle className="world-dot" cx="392" cy="112" r="5"/><circle className="world-dot" cx="181" cy="191" r="5"/><circle className="world-dot" cx="490" cy="118" r="5"/></g>
  </svg></div>;
}

export default function Contact() {
  const [form, setForm] = useState<ContactPayload>(initialForm);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const setField = (key: keyof ContactPayload, value: string) => { setForm((v) => ({ ...v, [key]: value })); setFeedback(null); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    try {
      const result = await submitContactMessage(form);
      setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
      if (result.ok) setForm(initialForm);
    } catch {
      setFeedback({ type: 'error', text: 'We couldn’t submit the demo message. Please try again.' });
    } finally { setSending(false); }
  };

  return (
    <>
      <section className="hero contact-hero">
        <div className="hero-map-layer"><DustMap intensity={52} activeZone="Zone 2" readings={[12, 28, 18]} showLegend={false} /></div>
        <div className="hero-copy">
          <Eyebrow icon={<MessageSquare size={12} />}>GET IN TOUCH</Eyebrow>
          <h1 className="hero-title">Let’s build cleaner, safer<br /><span>construction sites together.</span></h1>
          <p className="hero-description">We’re excited to collaborate with industry partners, researchers, communities and organizations to reduce construction dust and create healthier, more sustainable sites. Get in touch to request a demo, discuss project partnerships, or learn more about DustTwin.</p>
        </div>
      </section>

      <section className="contact-section">
        <div className="contact-intro">
          <h2>Contact <span>DustTwin</span></h2>
          <p>Have a question, want to see DustTwin in action, or interested in collaborating? Fill out the form and our team will get back to you shortly.</p>
          <div className="contact-reason"><span><MessageSquare size={29} /></span><div><h3>Request a live demo</h3><p>See DustTwin in action with real-world scenarios.</p></div></div>
          <div className="contact-reason"><span><Users size={29} /></span><div><h3>Explore partnerships</h3><p>Work with us on pilot projects and research collaborations.</p></div></div>
          <div className="contact-reason"><span><Building2 size={29} /></span><div><h3>Industry inquiries</h3><p>Discuss deployment, integration and licensing opportunities.</p></div></div>
          <div className="contact-reason"><span><FileText size={29} /></span><div><h3>General questions</h3><p>We’re here to help with any questions about DustTwin.</p></div></div>
        </div>

        <div className="contact-form-card">
          <h2 className="contact-form-title"><Mail size={21} />Send us a message</h2>
          <form className="contact-form" onSubmit={submit} noValidate>
            <div className="form-field"><label htmlFor="name">Name *</label><input id="name" name="name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Your full name" autoComplete="name" required /></div>
            <div className="form-field"><label htmlFor="organization">Organization</label><input id="organization" name="organization" value={form.organization} onChange={(e) => setField('organization', e.target.value)} placeholder="Your organization or company" autoComplete="organization" /></div>
            <div className="form-field full"><label htmlFor="email">Email *</label><input id="email" name="email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@company.com" autoComplete="email" required /></div>
            <div className="form-field full"><label htmlFor="subject">Subject *</label><select id="subject" name="subject" value={form.subject} onChange={(e) => setField('subject', e.target.value)} required><option value="">Select a topic</option><option value="demo">Request a live demo</option><option value="partnership">Partnership opportunity</option><option value="industry">Industry inquiry</option><option value="research">Research collaboration</option><option value="other">Other question</option></select></div>
            <div className="form-field full"><label htmlFor="message">Message *</label><textarea id="message" name="message" value={form.message} onChange={(e) => setField('message', e.target.value)} placeholder="Tell us about your project, question or collaboration idea..." maxLength={1000} required /><div className="form-counter">{form.message.length} / 1000</div></div>
            {feedback && <p className={`form-feedback ${feedback.type}`} role="status">{feedback.text}</p>}
            <button className="cta-button form-submit" type="submit" disabled={sending}><span>{sending ? 'Sending…' : 'Send Message'}</span><Send size={14} /></button>
          </form>
        </div>

        <div className="contact-info">
          <h2 className="contact-info-title"><Globe2 size={22} />Other ways to reach us</h2>
          <div className="contact-info-grid">
            <ContactCard icon={<Mail />} title="Email"><p><b>{siteConfig.contact.email}</b><br />We aim to respond within<br />{siteConfig.contact.responseTime.toLowerCase()}.</p></ContactCard>
            <ContactCard icon={<Phone />} title="Phone"><p><b>{siteConfig.contact.phone}</b><br />Mon – Fri, 9:00 AM – 6:00 PM<br />(PST) · placeholder</p></ContactCard>
            <ContactCard icon={<MapPin />} title="Location"><p><b>{siteConfig.contact.location}</b><br />Building healthier communities worldwide.</p></ContactCard>
          </div>
          <div className="impact-card"><div className="impact-copy"><h3><Globe2 size={23} />Our global impact</h3><p>DustTwin is designed for construction sites worldwide — from urban developments to infrastructure projects in every region.</p></div><WorldMap /></div>
          <div className="contact-demo-banner"><div className="contact-demo-copy"><Monitor /><div><h3>Request a Live Demo</h3><p>See how DustTwin can help your project reduce dust, improve air quality, and keep communities safer.</p></div></div><CTAButton to="/simulation">Launch Demo</CTAButton></div>
        </div>
      </section>
      <p className="placeholder-note">Contact details shown here are replaceable project placeholders. Update them in <code>src/data/site.ts</code>.</p>
    </>
  );
}
