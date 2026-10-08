import type { StudyLevel } from '@xcel/shared';

/**
 * Undergraduate scholarships open to Ghanaian students, researched on
 * 8 October 2026 from each provider's official website. Only details stated
 * on the official page are recorded; anything not stated is left empty.
 * Re-check each source before relying on it, as providers change details
 * every year.
 */

export interface ScholarshipRecord {
  slug: string;
  name: string;
  providerName: string;
  providerUrl: string;
  /** Provider logo saved from its official website into frontend/public/logos. */
  logoUrl: string | null;
  description: string;
  coverage: string | null;
  studyLevels: StudyLevel[];
  fields: string[];
  eligibilityCategories: string[];
  location: string;
  cycle: {
    academicYear: string;
    opensOn: string | null;
    closesOn: string | null;
    applicationUrl: string | null;
    /** The provider says applications have closed, though no closing date is published. */
    closed?: boolean;
  };
  requirements: string[];
  source: { title: string; url: string; publisher: string };
  /**
   * True when every detail above was confirmed on an official page. Records
   * that are not verified are imported as unpublished drafts.
   */
  verified: boolean;
  /** Why the record is (not) verified; stored with the verification record. */
  verificationNote: string;
}

const CHECKED_ON = '2026-10-08';
export const RESEARCHED_ON = CHECKED_ON;

export const GHANA_UNDERGRADUATE_SCHOLARSHIPS: ScholarshipRecord[] = [
  {
    slug: 'getfund-local-undergraduate-scholarship',
    name: 'GETFund Local Undergraduate Scholarship',
    providerName: 'Ghana Education Trust Fund (GETFund)',
    providerUrl: 'https://getfund.gov.gh/scholarships',
    logoUrl: '/logos/getfund.webp',
    description:
      'Government scholarship for Ghanaian students in diploma, HND and degree programmes at accredited tertiary institutions in Ghana.',
    coverage: null,
    studyLevels: ['diploma', 'undergraduate'],
    fields: [],
    eligibilityCategories: ['Need-based'],
    location: 'Ghana',
    cycle: {
      academicYear: '2026/2027',
      opensOn: '2026-10-05',
      closesOn: '2026-11-27',
      applicationUrl: 'https://scholarships.getfund.gov.gh/',
    },
    requirements: [
      'Ghanaian citizen',
      'Admitted to a diploma, HND or degree programme at an accredited tertiary institution in Ghana',
      'Apply online through the official GETFund scholarship portal only',
    ],
    source: {
      title: 'GETFund Scholarship Programme',
      url: 'https://getfund.gov.gh/scholarships',
      publisher: 'Ghana Education Trust Fund',
    },
    verified: false,
    verificationNote:
      'Dates come from news reports (e.g. Pulse Ghana, 5 October 2026). The official GETFund pages could not be read, and reports disagree on what the award covers. Confirm on the GETFund portal before publishing.',
  },
  {
    slug: 'gsa-local-tertiary-scholarship',
    name: 'Ghana Scholarships Authority Local Tertiary Scholarship',
    providerName: 'Ghana Scholarships Authority',
    providerUrl: 'https://scholarships.gov.gh/',
    logoUrl: '/logos/gsa.webp',
    description:
      'Government scholarship for Ghanaian students admitted to public universities in Ghana to study STEM-related courses or Law.',
    coverage: null,
    studyLevels: ['undergraduate'],
    fields: ['STEM', 'Law'],
    eligibilityCategories: [],
    location: 'Ghana',
    cycle: {
      academicYear: '2026/2027',
      opensOn: '2026-04-10',
      closesOn: '2026-05-15',
      applicationUrl: 'https://apply.scholarships.gov.gh/',
    },
    requirements: [
      'Ghanaian and resident in Ghana',
      'Admitted to and registered at a public university in Ghana',
      'Studying a STEM-related course or Law',
      'Sit an aptitude test and attend a selection interview at a selected MMDA',
      'Applying is free',
    ],
    source: {
      title: 'Local Tertiary Scholarship Applications for 2026/2027 Academic Year',
      url: 'https://scholarships.gov.gh/opportunities/local-tertiary-scholarship-applications-for-20262027-academic-year',
      publisher: 'Ghana Scholarships Authority',
    },
    verified: true,
    verificationNote: `Checked against the official notice on ${CHECKED_ON}.`,
  },
  {
    slug: 'algeria-ghana-government-scholarship',
    name: 'Joint Algeria/Ghana Government Scholarship',
    providerName: 'Ghana Scholarships Authority',
    providerUrl: 'https://scholarships.gov.gh/',
    logoUrl: '/logos/gsa.webp',
    description:
      'Government scholarship for recent SHS graduates to study in Algeria, in fields including science, technology, medicine and agricultural sciences.',
    coverage: null,
    studyLevels: ['undergraduate', 'certificate'],
    fields: [
      'Science',
      'Technology',
      'Mathematics',
      'Computer Science',
      'Architecture',
      'Medicine',
      'Veterinary Sciences',
      'Dentistry',
      'Agricultural Sciences',
      'Pharmacy',
      'Urban Planning',
      'Graphic Design',
      'Cybersecurity',
      'Automotive Mechatronics',
      'Islamic Studies',
    ],
    eligibilityCategories: ['Merit'],
    location: 'Algeria',
    cycle: {
      academicYear: '2026/2027',
      opensOn: '2026-09-05',
      closesOn: '2026-09-21',
      applicationUrl: 'https://scholarships.gov.gh/',
    },
    requirements: [
      'Ghanaian citizen resident in Ghana',
      'Not more than 23 years old',
      'Completed SHS with current (2025) WASSCE results',
      'WASSCE aggregate of 13 or better',
      'Valid birth certificate and passport',
    ],
    source: {
      title:
        'The Joint Algeria/Ghana Government Scholarship Awards for the 2026/2027 Academic Year',
      url: 'https://scholarships.gov.gh/opportunities/the-joint-algeriaghana-government-scholarship-awards-for-the-20262027-academic-year-tenable-in-algeria',
      publisher: 'Ghana Scholarships Authority',
    },
    verified: true,
    verificationNote: `Checked against the official notice on ${CHECKED_ON}.`,
  },
  {
    slug: 'mtn-bright-scholarship',
    name: 'MTN Ghana Foundation Bright Scholarship',
    providerName: 'MTN Ghana Foundation',
    providerUrl: 'https://scholarship.mtn.com.gh/',
    logoUrl: '/logos/mtn.svg',
    description:
      '500 awards for Ghanaian students at public tertiary institutions: 300 for STEM, vocational and technical courses, and 200 for teachers pursuing further education at public universities.',
    coverage: 'Tuition, accommodation and essential learning resources',
    studyLevels: ['undergraduate'],
    fields: ['STEM', 'Vocational and technical', 'Education'],
    eligibilityCategories: ['Merit'],
    location: 'Ghana',
    cycle: {
      academicYear: '2026/2027',
      opensOn: null,
      closesOn: '2026-05-31',
      applicationUrl: 'https://scholarship.mtn.com.gh/',
    },
    requirements: [
      'Ghanaian citizen',
      'Pursuing a first degree, or vocational or technical skills training, at a public tertiary institution',
      'Outstanding academic achievement and exemplary conduct',
      'Not subject to disciplinary action',
      'Apply online only; applying is free',
    ],
    source: {
      title: 'MTN Ghana Foundation opens application for 2026 Bright Scholarship',
      url: 'https://mtn.com.gh/newsabout/mtn-ghana-foundation-opens-application-for-2026-bright-scholarship/',
      publisher: 'MTN Ghana',
    },
    verified: true,
    verificationNote: `Checked against MTN Ghana's official announcement (22 April 2026) on ${CHECKED_ON}.`,
  },
  {
    slug: 'mastercard-foundation-scholars-knust',
    name: 'Mastercard Foundation Scholars Program at KNUST',
    providerName: 'Mastercard Foundation',
    providerUrl: 'https://mcf.knust.edu.gh/mastercard-foundation/',
    logoUrl: '/logos/mastercard-foundation.webp',
    description:
      'Undergraduate scholarships at Kwame Nkrumah University of Science and Technology for academically talented young Africans.',
    coverage: null,
    studyLevels: ['undergraduate'],
    fields: [],
    eligibilityCategories: [
      'Need-based',
      'Persons with disabilities',
      'Refugees and displaced persons',
    ],
    location: 'Kumasi, Ghana',
    cycle: {
      academicYear: '2026/2027',
      opensOn: null,
      closesOn: null,
      applicationUrl: 'https://mcf.knust.edu.gh/mastercard-foundation/',
    },
    requirements: [
      'Open to students from Africa studying at KNUST',
      'Priority for persons with disabilities, refugees and displaced persons',
      'See the KNUST Mastercard Foundation website for the current call and deadline',
    ],
    source: {
      title:
        'Mastercard Foundation Scholars Program: Kwame Nkrumah University of Science & Technology',
      url: 'https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/where-to-apply/kwame-nkrumah-university-of-science-and-technology-knust/',
      publisher: 'Mastercard Foundation',
    },
    verified: true,
    verificationNote: `Checked against the Mastercard Foundation's official page on ${CHECKED_ON}. The KNUST programme website was unreachable, so 2026/2027 dates are not recorded.`,
  },
  {
    slug: 'gnpc-foundation-local-scholarship',
    name: 'GNPC Foundation Local Scholarship',
    providerName: 'GNPC Foundation',
    providerUrl: 'https://www.gnpcghana.com/gnpc-foundation',
    logoUrl: '/logos/gnpc.webp',
    description:
      'Ghana National Petroleum Corporation scholarship for Ghanaian students at accredited tertiary institutions in Ghana.',
    coverage: null,
    studyLevels: ['undergraduate'],
    fields: [],
    eligibilityCategories: [],
    location: 'Ghana',
    cycle: {
      academicYear: '2026/2027',
      opensOn: null,
      closesOn: null,
      applicationUrl: 'https://www.gnpcghana.com/gnpc-foundation',
    },
    requirements: [
      'Ghanaian citizen',
      'Admitted to a GTEC-accredited tertiary institution in Ghana (new and continuing students)',
      'Credit passes (A1–C6) in six WASSCE subjects, including English, Mathematics, and Integrated Science or Social Studies',
      'Continuing students: a GPA of at least 2.0',
      'Not already a beneficiary of another scholarship scheme',
    ],
    source: {
      title: 'GNPC Foundation',
      url: 'https://www.gnpcghana.com/gnpc-foundation',
      publisher: 'Ghana National Petroleum Corporation',
    },
    verified: true,
    verificationNote: `Selection criteria checked against GNPC's official page on ${CHECKED_ON}. The page gives no 2026/2027 dates.`,
  },
  {
    slug: 'ashesi-need-based-scholarships',
    name: 'Ashesi University Need-Based Scholarships',
    providerName: 'Ashesi University',
    providerUrl: 'https://ashesi.edu.gh/how-to-apply/',
    logoUrl: '/logos/ashesi.webp',
    description:
      'All undergraduate scholarships at Ashesi are need-based; Ashesi does not award merit-based undergraduate scholarships.',
    coverage: 'Partial or full, depending on financial need',
    studyLevels: ['undergraduate'],
    fields: [],
    eligibilityCategories: ['Need-based'],
    location: 'Berekuso, Ghana',
    cycle: {
      academicYear: '2026/2027',
      // Applications are accepted in rounds; the October and December 2026 rounds are open.
      opensOn: '2026-09-22',
      closesOn: null,
      applicationUrl: 'https://ashesi.edu.gh/how-to-apply/',
    },
    requirements: [
      'Qualify for admission to an Ashesi undergraduate programme',
      'Complete the financial aid form with your application, stating the amount of assistance you need',
      'Ashesi accepts applications in four rounds a year (June, August, October and December deadlines)',
    ],
    source: {
      title: 'How to Apply – Ashesi University',
      url: 'https://ashesi.edu.gh/how-to-apply/',
      publisher: 'Ashesi University',
    },
    verified: true,
    verificationNote: `Checked against Ashesi's official admissions page on ${CHECKED_ON}. Shown as open from 22 September 2026, when a UNHCR notice confirmed the October and December 2026 rounds were open; exact round deadlines are not published.`,
  },
  {
    slug: 'thrive-and-shine-steam-scholarship',
    name: 'Thrive and Shine Scholarship Fund',
    providerName: 'Thrive and Shine LBG',
    providerUrl: 'https://www.thrivenshine.org/',
    logoUrl: '/logos/thrive-and-shine.webp',
    description:
      'Need-based scholarships for high-potential students pursuing STE(A)M education who face financial hardship or other barriers, across Ghana and Africa.',
    coverage: 'Full or partial: tuition, books, mentorship and tech resources',
    // The provider does not state which study levels are supported.
    studyLevels: [],
    fields: ['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics'],
    eligibilityCategories: ['Need-based', 'Women and girls in STE(A)M'],
    location: 'Ghana and Africa',
    cycle: {
      academicYear: '2026/2027',
      opensOn: null,
      closesOn: null,
      applicationUrl: 'https://www.thrivenshine.org/scholarship/apply',
      closed: true,
    },
    requirements: [
      'Pursuing STE(A)M education (science, technology, engineering, arts or mathematics)',
      'Demonstrated need: financial hardship, lack of access to educational resources, or barriers tied to gender or location',
      'Strong performance in STE(A)M subjects',
      'A desire to give back and uplift others in marginalised communities',
      'Priority for under-represented regions and for women and girls in STE(A)M',
      'Shortlisted applicants are interviewed, virtually or in person',
    ],
    source: {
      title: 'Thrive And Shine Scholarship Fund',
      url: 'https://www.thrivenshine.org/scholarship',
      publisher: 'Thrive and Shine LBG',
    },
    verified: true,
    verificationNote: `Checked against the official scholarship and application pages on ${CHECKED_ON}. The 2026 cycle is closed ("Applications for the 2026 cycle are no longer being accepted"); applications open annually. The provider calls it the "2026 cycle", recorded here as 2026/2027. Study levels are not stated.`,
  },
  {
    slug: 'fawe-ghana-mastercard-foundation-bursary',
    name: 'FAWE Ghana/Mastercard Foundation Second Chance Bursary',
    providerName: 'FAWE Ghana (Forum for African Women Educationalists) and Mastercard Foundation',
    providerUrl: 'https://fawegh.org/',
    logoUrl: '/logos/fawe-ghana.webp',
    description:
      '200 fully funded bursaries for marginalised young Ghanaians to study STEM-related HND or Diploma programmes at FAWE Ghana partner technical universities. 80% of bursaries are reserved for female applicants and 20% for male applicants, with 5–15% for persons with disabilities, refugees and internally displaced persons.',
    coverage: 'Fully funded',
    studyLevels: ['diploma'],
    fields: ['STEM'],
    eligibilityCategories: [
      'Need-based',
      'Women',
      'Persons with disabilities',
      'Refugees and displaced persons',
    ],
    location: 'Ghana',
    cycle: {
      academicYear: '2026/2027',
      opensOn: null,
      closesOn: '2026-09-15',
      applicationUrl:
        'https://fawegh.org/2026/08/07/call-for-application-for-the-fawe-mastercard-foundation-second-chance-pathways-for-increased-access-to-tertiary-education-for-marginalized-young-women-and-men-program-at-fawe-ghana-join-the-third-coh/',
    },
    requirements: [
      'Ghanaian, from any of the 16 regions',
      'Aged 15–25 at the time of application',
      'Completed WASSCE or Certificate II and qualify for tertiary education',
      'Demonstrated financial need',
      'Already admitted to one of FAWE Ghana’s 11 partner institutions: Accra, Bolgatanga, Cape Coast, Dr. Hilla Limann, Ho, Koforidua, Kumasi, Sunyani, Takoradi and Tamale Technical Universities, and USTED',
      'Studying a STEM-related 3-year HND or 2-year Diploma programme',
      'Not for continuing students, top-up or degree programmes, or conditional or probationary admission',
    ],
    source: {
      title:
        'Call for Application: FAWE/Mastercard Foundation Second Chance Pathways Program (Third Cohort)',
      url: 'https://fawegh.org/2026/08/07/call-for-application-for-the-fawe-mastercard-foundation-second-chance-pathways-for-increased-access-to-tertiary-education-for-marginalized-young-women-and-men-program-at-fawe-ghana-join-the-third-coh/',
      publisher: 'FAWE Ghana',
    },
    verified: true,
    verificationNote: `Checked against FAWE Ghana's official call for applications (published 7 August 2026) on ${CHECKED_ON}. The official deadline is 15 September 2026; some third-party listings show 21 August 2026.`,
  },
  {
    slug: 'mastercard-foundation-scholars-ashesi',
    name: 'Mastercard Foundation Scholars Program at Ashesi University',
    providerName: 'Mastercard Foundation and Ashesi University',
    providerUrl: 'https://ashesi.edu.gh/the-mastercard-foundation-scholars-programme/',
    logoUrl: '/logos/mastercard-foundation.webp',
    description:
      'Comprehensive undergraduate scholarships at Ashesi University for young people across Africa. Ashesi awards it from its general scholarship application: there is no separate form.',
    coverage:
      'All fees, room and board, and learning resources, plus support to transition into Ashesi',
    studyLevels: ['undergraduate'],
    fields: [],
    eligibilityCategories: ['Need-based'],
    location: 'Berekuso, Ghana',
    cycle: {
      academicYear: '2026/2027',
      // The October and December 2026 application rounds are open.
      opensOn: '2026-09-22',
      closesOn: null,
      applicationUrl: 'https://ashesi.edu.gh/how-to-apply/',
    },
    requirements: [
      'Apply for admission to an Ashesi undergraduate programme and complete the scholarship (financial aid) application',
      'Ashesi’s Admissions and Financial Aid Office decides which award you receive, including this one; you cannot choose it',
      'Applications are reviewed in rounds; the current rounds close in October and December 2026',
    ],
    source: {
      title: 'The Mastercard Foundation Scholars Program – Ashesi University',
      url: 'https://ashesi.edu.gh/the-mastercard-foundation-scholars-programme/',
      publisher: 'Ashesi University',
    },
    verified: true,
    verificationNote: `Coverage and how it is awarded checked against Ashesi's official programme page on ${CHECKED_ON}. Open rounds (October and December 2026) confirmed by a UNHCR notice dated 22 September 2026 (https://help.unhcr.org/rwanda/2026/09/22/call-for-applications-mastercard-foundation-scholarships-open-for-application/). Exact round deadlines are not published; some third-party sites give 16 November 2026, which is unconfirmed.`,
  },
  {
    slug: 'pecan-inspire-scholarship',
    name: 'Pecan Inspire Scholarship Program (PISP)',
    providerName: 'Pecan Energies',
    providerUrl: 'https://pecanenergiesscholarships.com/',
    logoUrl: '/logos/pecan-energies.svg',
    description:
      'The flagship scholarship of Pecan Energies and its licence partners (Lukoil Overseas Ghana Tano, GNPC and Fueltrade) for promising Ghanaian tertiary students from low-income households. At least 80% of places are reserved for coastal districts of the Western Region.',
    coverage:
      'Full tuition and housing, a laptop, a stipend, and mentoring and counselling throughout your studies',
    studyLevels: ['undergraduate'],
    fields: [],
    eligibilityCategories: ['Need-based', 'Western Region'],
    location: 'Ghana (priority for the Western Region)',
    cycle: {
      academicYear: '2026/2027',
      opensOn: null,
      closesOn: null,
      applicationUrl: 'https://pecanenergiesscholarships.com/apply',
      closed: true,
    },
    requirements: [
      'Ghanaian student pursuing tertiary (university) education',
      'Promising but financially challenged: the programme targets students from low-income households',
      'At least 80% of places are reserved for students from coastal districts of the Western Region; the rest are for other regions of Ghana',
      'Open to eligible students regardless of gender, age or educational background',
    ],
    source: {
      title: 'About Us – Pecan Inspire Scholarship Program',
      url: 'https://pecanenergiesscholarships.com/about-us',
      publisher: 'Pecan Energies',
    },
    verified: true,
    verificationNote: `Checked against the official PISP website on ${CHECKED_ON}. The application page says "APPLICATIONS CLOSED" and gives no dates for the next round; the latest announced cohort is 2023/2024 (Pecan Energies, 15 January 2024).`,
  },
];
