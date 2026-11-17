// ---------------------------------------------------------------------------
// content: everything shown in the panels. Text follows the resume; links were
// checked against the organisations' own sites.
// ---------------------------------------------------------------------------
const L = {
  cas: 'https://as.cornell.edu/',
  physics: 'https://physics.cornell.edu/',
  rcprs: 'https://scl.cornell.edu/growth-opportunities/rawlings-cornell-presidential-research-scholars',
  scholar: 'https://as.cornell.edu/major_minor_gradfield/robert-s-harrison-college-scholar-program',
  oib: 'https://international.collegeboard.org/students/issp/bfi',
  barstow: 'https://barstow.bee.cornell.edu/',
  mason: 'https://www.masonlab.net/',
  ludwig: 'https://www.ludwigcancerresearch.org/location/new-yorkweill-cornell/',
  meyer: 'https://meyercancer.weill.cornell.edu/',
  bowers: 'https://bowers.cornell.edu/',
  morrison: 'https://scl.cornell.edu/residential-life/housing/campus-housing/upper-level-undergraduates/residence-halls/toni-morrison-hall',
  pla: 'https://physics.cornell.edu/learning-assistant-program',
  doi: 'https://doi.org/10.1016/j.ctarc.2026.101109',
  pubmed: 'https://pubmed.ncbi.nlm.nih.gov/41576524/',
  jesse: 'https://www.jesse-zhou.com/',
  github: 'https://github.com/AymanAbouAlfa',
  repo: 'https://github.com/AymanAbouAlfa/AymanAbouAlfa.github.io',
  claude: 'https://claude.com/claude-code',
};
const A = (k, t) => `<a href="${L[k]}" target="_blank" rel="noopener">${t}</a>`;
const role = (title, dates, where, bullets, links) => `<h2>${title}</h2><p class="meta">${dates}</p><p class="where">${where}</p><ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>${links ? `<p class="links">${links}</p>` : ''}`;

// id -> { t: tag text, h: panel heading, c: tape colour, side, parent, html }
const SEC = {
  education: {
    t: 'Education', c: '#f6d55c', side: 'r',
    html: `<h2>Cornell University</h2><p class="where">College of Arts &amp; Sciences · Ithaca, NY</p>
      <dl><dt>Degree</dt><dd>Bachelor of Arts in Physics and Biophysics</dd><dt>Graduation</dt><dd>Anticipated May 2027</dd><dt>Cumulative GPA</dt><dd>4.111</dd></dl>
      <p class="links">${A('cas', 'College of Arts &amp; Sciences')}${A('physics', 'Department of Physics')}</p>`,
  },
  honors: {
    t: 'Honors & Awards', c: '#f79d65', side: 'r',
    html: `<ul class="plain">
      <li><b>Hunter R. Rawlings III Cornell Presidential Research Scholar</b><span>${A('rcprs', 'About the program')}</span></li>
      <li><b>Robert S. Harrison College Scholar</b><span>${A('scholar', 'About the program')}</span></li>
      <li><b>Option International du Baccalauréat</b><span>Admis Mention Très Bien avec les Félicitations du Jury · ${A('oib', 'About the OIB')}</span></li>
      <li><b>Board of Trustees Award</b><span>Class of 2023</span></li></ul>`,
  },
  research: { t: 'Research', c: '#7bd389', group: ['barstow', 'mason', 'wolchok'], hint: 'Three labs, three plates. Click one.' },
  barstow: {
    t: 'Barstow Lab', h: 'Research · Biological Engineering', c: '#7bd389', side: 'r', parent: 'research',
    html: role('Biological Engineering Research Assistant', 'May 2025 – Present', 'Professor Buz Barstow, Cornell, New York, NY', [
      'Project’s aim is to identify and characterize DNA sequences extracted from rocks that code for biomining capabilities',
      'Write annotations for <i>G. oxydans</i> genome to generate knockout and knockdown collections',
      'Prepare competition assays to assess metal bioleaching in engineered <i>G. oxydans</i> and <i>V. natriegens</i>'], A('barstow', 'Barstow Lab')),
  },
  mason: {
    t: 'Mason Lab', h: 'Research · Biophysics', c: '#7bd389', side: 'r', parent: 'research',
    html: role('Biophysics Research Assistant', 'May 2025 – September 2025', 'Professor Christopher Mason, Weill Cornell Medicine, New York, NY', [
      'Identified endogenous radioresistant genes to be used as radiation countermeasures during deep-space missions',
      'Prepared and amplified gene-edited cell samples, using CRISPRi/a, for sequencing and omics analysis'], A('mason', 'The Mason Lab')),
  },
  wolchok: {
    t: 'Wolchok & Merghoub', h: 'Research · Immunology', c: '#7bd389', side: 'r', parent: 'research',
    html: role('Immunology Research Assistant', 'June 2024 – September 2024', 'Dr. Jedd D. Wolchok &amp; Professor Taha Merghoub, Weill Cornell Medicine, New York, NY', [
      'Project’s aim was to identify MHC peptides that could be used as targets in therapeutic cancer vaccines',
      'Analyzed biopsied tissue using multiplex immunofluorescence, HALO software, and custom-made ML algorithm'],
      A('ludwig', 'Ludwig Collaborative Laboratory') + A('meyer', 'Meyer Cancer Center')),
  },
  skills: {
    t: 'Skills', c: '#6ec6f0', side: 'r',
    html: `<div class="vial" style="--v:#2f6fd0"><h3>Laboratory</h3><p>Flow Cytometry · Multiplex Immunofluorescence · PCR · Gel Electrophoresis · Chromatography</p></div>
      <div class="vial" style="--v:#2f9a61"><h3>Programming</h3><p>Python (data analysis, machine learning) · R (data analysis) · Java</p></div>
      <div class="vial" style="--v:#e2752b"><h3>Languages</h3><p>English (native) · French (native) · Mandarin (intermediate)</p></div>`,
  },
  teaching: {
    t: 'Teaching', c: '#f08fd0', notebook: true,
    left: role('Computer Science Teaching Assistant', 'August 2025 – Present', `${A('bowers', 'Bowers College of Computing and Information Science')}, Cornell University, Ithaca, NY`, [
      'Lead computer science recitations on data structures and object-oriented programming',
      'Host weekly office hours, grade assignments, and moderate discussion board']),
    right: role('French Residential Language Fellow', 'September 2024 – Present', `${A('morrison', 'Toni Morrison Hall')}, Cornell University, Ithaca, NY`, [
      'Serve as a live-in francophone RA: supervise and teach French to 14 select residents',
      'Organize social activities involving French culture, alongside relevant faculty and campus partners'])
      + role('Physics Learning Assistant', 'September 2024 – May 2025', `${A('pla', 'Department of Physics')}, Cornell University, Ithaca, NY`, [
        'Led physics recitations on introductory mechanics and electromagnetism for biology students']),
  },
  publications: {
    t: 'Publications', c: '#f0726a', side: 'l',
    html: `<p class="cite">Lee JW, Jin X, Bogdan S, <b>Abou-Alfa A</b>, Chang J, Rafizadeh M, Kang EC, Garcia C, Zhou XK, Saxena A. 2026.
      <b>Comprehensive clinical characteristics and outcomes of stage IV EGFR-mutant NSCLC based on PD-L1 expression.</b>
      <i>Cancer Treatment and Research Communications.</i></p><p class="links">${A('doi', 'Read the article (DOI)')}${A('pubmed', 'PubMed')}</p>`,
  },
  contact: {
    t: 'Contact', c: '#a594f7', side: 'l',
    html: `<h2>Ayman Abou-Alfa</h2><p class="where">Physics &amp; Biophysics · Cornell University</p>
      <dl><dt>Email</dt><dd><a href="mailto:aga56@cornell.edu">aga56@cornell.edu</a></dd><dt>Based in</dt><dd>New York, NY · Ithaca, NY</dd><dt>Code</dt><dd>${A('github', 'github.com/AymanAbouAlfa')}</dd></dl>`,
  },
  ack: {
    t: 'Acknowledgments', c: '#5fd0c0', side: 'l',
    html: `<h3>Inspiration</h3><p>The idea of a small 3D scene that doubles as the site’s menu comes from ${A('jesse', 'Jesse Zhou’s ramen-shop portfolio')}. Nothing from it is reused here; everything was written from scratch.</p>
      <h3>How Claude was used</h3><p>This site was built in ${A('claude', 'Claude Code')} with <b>Claude Fable 5.2</b> (model ID <code>claude-fable-5-2</code>), from my brief and résumé. Claude wrote the WebGL2 renderer (no 3D library), modelled every object in code, and wrote the shaders and interface.</p>
      <p>Renders of each build were reviewed by a separate Claude subagent (Claude Sonnet 5.5) that was shown only the images, and frame times were measured with GPU timer queries in Firefox.</p>
      <p>Concept, scene direction and content: Ayman Abou-Alfa. ${A('repo', 'Source on GitHub')}</p>`,
  },
};
const HOME_IDS = ['education', 'honors', 'research', 'skills', 'teaching', 'publications', 'contact', 'ack'];
