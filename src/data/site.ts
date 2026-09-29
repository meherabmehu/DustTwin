export const siteConfig = {
  brand: 'DustTwin',
  tagline: 'Cleaner air. Smarter sites.',
  // Replace these obvious placeholders with approved public contact details.
  contact: {
    email: 'hello@dusttwin.example',
    phone: '+1 (415) 555-0123',
    location: 'San Francisco, CA, USA · placeholder',
    responseTime: 'Within 1 business day',
  },
};

export const navItems = [
  { label: 'Overview', path: '/' },
  { label: 'Problem', path: '/problem' },
  { label: 'How It Works', path: '/how-it-works' },
  { label: 'Simulation', path: '/simulation' },
  { label: 'Circuit Simulation', path: '/circuit-simulation' },
  { label: 'Prototype Demo', path: '/prototype' },
  { label: 'Results', path: '/results' },
  { label: 'Team', path: '/team' },
  { label: 'Contact', path: '/contact' },
];

export const teamMembers = [
  {
    name: 'Team Member 1',
    role: 'AI & Simulation',
    description: 'Develops AI models and simulation techniques to predict dust movement and optimize mitigation strategies.',
    skills: ['Machine Learning', 'CFD', 'Data Analysis'],
    image: '/images/team-ai.jpg',
    icon: 'brain',
  },
  {
    name: 'Team Member 2',
    role: 'IoT & Hardware',
    description: 'Designs and builds sensor systems and control hardware for real-time dust monitoring and mitigation.',
    skills: ['Sensors', 'Edge Processing', 'Smart Control'],
    image: '/images/team-iot.jpg',
    icon: 'cpu',
  },
  {
    name: 'Team Member 3',
    role: 'Web Dashboard',
    description: 'Builds interactive dashboards to visualize dust predictions, system status, and real-time impact.',
    skills: ['Web Development', 'Data Visualization'],
    image: '/images/team-ai.jpg',
    icon: 'monitor',
  },
  {
    name: 'Team Member 4',
    role: 'Research & Validation',
    description: 'Conducts research, validates models with real-world data, and evaluates environmental and health impact.',
    skills: ['Environmental Science', 'Data Validation'],
    image: '/images/team-iot.jpg',
    icon: 'book',
  },
  {
    name: 'Team Member 5',
    role: 'Presentation & Outreach',
    description: 'Communicates our work through prototypes, demos, and storytelling to drive adoption and real-world impact.',
    skills: ['Product Design', 'Strategy', 'Partnerships'],
    image: '/images/team-ai.jpg',
    icon: 'presentation',
  },
];
