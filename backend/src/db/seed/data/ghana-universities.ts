import type { GhanaRegion, InstitutionType } from '@xcel/shared';

/**
 * Ghana's universities as accredited by the Ghana Tertiary Education
 * Commission (GTEC): its "Traditional University", "Public Technical
 * University", "Chartered Private Tertiary Institution" and "Private
 * University" categories, as listed on 2026-10-08.
 *
 * - Names are GTEC's, except where noted in `nameNote` (legal renames under
 *   the December 2025 amendments, and full official names GTEC shortens).
 * - Regions come from the town GTEC lists.
 * - Every website was opened on 2026-10-08 to confirm it is the
 *   institution's own. Admissions pages and descriptions are left for the
 *   administrator to add from each institution's official pages.
 * - KNUST and the University of Ghana are loaded with their programmes by
 *   the university importer, so they are not repeated here.
 */
export const DIRECTORY_CHECKED_ON = '2026-10-08';

export const DIRECTORY_SOURCE = {
  title: 'GTEC accredited institutions by category',
  url: 'https://gtec.edu.gh/institutional-categories/',
  publisher: 'Ghana Tertiary Education Commission (GTEC)',
};

export type GtecCategory =
  | 'Traditional University'
  | 'Public Technical University'
  | 'Chartered Private Tertiary Institution'
  | 'Private University';

export interface DirectoryUniversity {
  slug: string;
  name: string;
  shortName: string | null;
  institutionType: InstitutionType;
  region: GhanaRegion;
  town: string;
  websiteUrl: string | null;
  gtecCategory: GtecCategory;
  /** How the name differs from GTEC's list, and why. */
  nameNote?: string;
}

const RENAMED_2025 = (oldName: string, act: string) =>
  `Listed by GTEC as "${oldName}"; renamed in December 2025 (${act}).`;

const publicUni = (
  u: Omit<DirectoryUniversity, 'institutionType' | 'gtecCategory'>,
): DirectoryUniversity => ({
  ...u,
  institutionType: 'public_university',
  gtecCategory: 'Traditional University',
});
const technical = (
  u: Omit<DirectoryUniversity, 'institutionType' | 'gtecCategory'>,
): DirectoryUniversity => ({
  ...u,
  institutionType: 'technical_university',
  gtecCategory: 'Public Technical University',
});
const chartered = (
  u: Omit<DirectoryUniversity, 'institutionType' | 'gtecCategory'>,
): DirectoryUniversity => ({
  ...u,
  institutionType: 'private_university',
  gtecCategory: 'Chartered Private Tertiary Institution',
});

export const GHANA_UNIVERSITIES: DirectoryUniversity[] = [
  // ---------- Public universities (GTEC: Traditional University) ----------
  publicUni({
    slug: 'usted',
    name: 'University of Skills Training and Entrepreneurial Development, Kumasi',
    shortName: 'USTED',
    region: 'ashanti',
    town: 'Kumasi',
    websiteUrl: 'https://usted.edu.gh',
    nameNote: RENAMED_2025(
      'Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development',
      'Act 1162',
    ),
  }),
  publicUni({
    slug: 'utas',
    name: 'University of Technology and Applied Sciences, Navrongo',
    shortName: 'UTAS',
    region: 'upper_east',
    town: 'Navrongo',
    websiteUrl: 'https://utas.edu.gh',
    nameNote: RENAMED_2025(
      'C.K. Tedam University of Technology and Applied Sciences',
      'Act 1161 as amended',
    ),
  }),
  publicUni({
    slug: 'gctu',
    name: 'Ghana Communication Technology University',
    shortName: 'GCTU',
    region: 'greater_accra',
    town: 'Tesano, Accra',
    websiteUrl: 'https://gctu.edu.gh',
  }),
  publicUni({
    slug: 'gimpa',
    name: 'Ghana Institute of Management and Public Administration',
    shortName: 'GIMPA',
    region: 'greater_accra',
    town: 'Achimota, Accra',
    websiteUrl: 'https://gimpa.edu.gh',
  }),
  publicUni({
    slug: 'ubids',
    name: 'University of Business and Integrated Development Studies, Wa',
    shortName: 'UBIDS',
    region: 'upper_west',
    town: 'Wa',
    websiteUrl: 'https://ubids.edu.gh',
    nameNote: RENAMED_2025(
      'S.D. Dombo University of Business and Integrated Development Studies',
      'Amendment Act 2025',
    ),
  }),
  publicUni({
    slug: 'uds',
    name: 'University for Development Studies',
    shortName: 'UDS',
    region: 'northern',
    town: 'Tamale',
    websiteUrl: 'https://uds.edu.gh',
  }),
  publicUni({
    slug: 'ucc',
    name: 'University of Cape Coast',
    shortName: 'UCC',
    region: 'central',
    town: 'Cape Coast',
    websiteUrl: 'https://ucc.edu.gh',
  }),
  publicUni({
    slug: 'uew',
    name: 'University of Education, Winneba',
    shortName: 'UEW',
    region: 'central',
    town: 'Winneba',
    websiteUrl: 'https://uew.edu.gh',
  }),
  publicUni({
    slug: 'uenr',
    name: 'University of Energy and Natural Resources',
    shortName: 'UENR',
    region: 'bono',
    town: 'Sunyani',
    websiteUrl: 'https://uenr.edu.gh',
  }),
  publicUni({
    slug: 'uesd',
    name: 'University of Environment and Sustainable Development',
    shortName: 'UESD',
    region: 'eastern',
    town: 'Somanya',
    websiteUrl: 'https://uesd.edu.gh',
  }),
  publicUni({
    slug: 'uhas',
    name: 'University of Health and Allied Sciences',
    shortName: 'UHAS',
    region: 'volta',
    town: 'Ho',
    websiteUrl: 'https://uhas.edu.gh',
    nameNote:
      'Listed by GTEC as "University of Health and Allied Science"; the official name ends in "Sciences".',
  }),
  publicUni({
    slug: 'unimac',
    name: 'University of Media, Arts and Communication',
    shortName: 'UniMAC',
    region: 'greater_accra',
    town: 'South Legon, Accra',
    websiteUrl: 'https://unimac.edu.gh',
  }),
  publicUni({
    slug: 'umat',
    name: 'University of Mines and Technology',
    shortName: 'UMaT',
    region: 'western',
    town: 'Tarkwa',
    websiteUrl: 'https://umat.edu.gh',
  }),
  publicUni({
    slug: 'upsa',
    name: 'University of Professional Studies, Accra',
    shortName: 'UPSA',
    region: 'greater_accra',
    town: 'Legon, Accra',
    websiteUrl: 'https://upsa.edu.gh',
  }),

  // ---------- Public technical universities ----------
  technical({
    slug: 'atu',
    name: 'Accra Technical University',
    shortName: 'ATU',
    region: 'greater_accra',
    town: 'Accra',
    websiteUrl: 'https://atu.edu.gh',
  }),
  technical({
    slug: 'btu',
    name: 'Bolgatanga Technical University',
    shortName: 'BTU',
    region: 'upper_east',
    town: 'Bolgatanga',
    websiteUrl: 'https://bolgatu.edu.gh',
  }),
  technical({
    slug: 'cctu',
    name: 'Cape Coast Technical University',
    shortName: 'CCTU',
    region: 'central',
    town: 'Cape Coast',
    websiteUrl: 'https://cctu.edu.gh',
  }),
  technical({
    slug: 'dhltu',
    name: 'Dr. Hilla Limann Technical University',
    shortName: 'DHLTU',
    region: 'upper_west',
    town: 'Wa',
    websiteUrl: 'https://dhltu.edu.gh',
  }),
  technical({
    slug: 'htu',
    name: 'Ho Technical University',
    shortName: 'HTU',
    region: 'volta',
    town: 'Ho',
    websiteUrl: 'https://htu.edu.gh',
  }),
  technical({
    slug: 'ktu',
    name: 'Koforidua Technical University',
    shortName: 'KTU',
    region: 'eastern',
    town: 'Koforidua',
    websiteUrl: 'https://ktu.edu.gh',
  }),
  technical({
    slug: 'kstu',
    name: 'Kumasi Technical University',
    shortName: 'KsTU',
    region: 'ashanti',
    town: 'Kumasi',
    websiteUrl: 'https://kstu.edu.gh',
  }),
  technical({
    slug: 'stu',
    name: 'Sunyani Technical University',
    shortName: 'STU',
    region: 'bono',
    town: 'Sunyani',
    websiteUrl: 'https://stu.edu.gh',
  }),
  technical({
    slug: 'ttu',
    name: 'Takoradi Technical University',
    shortName: 'TTU',
    region: 'western',
    town: 'Takoradi',
    websiteUrl: 'https://ttu.edu.gh',
  }),
  technical({
    slug: 'tatu',
    name: 'Tamale Technical University',
    shortName: 'TaTU',
    region: 'northern',
    town: 'Tamale',
    websiteUrl: 'https://tatu.edu.gh',
  }),

  // ---------- Chartered private universities ----------
  chartered({
    slug: 'academic-city-university',
    name: 'Academic City University',
    shortName: null,
    region: 'greater_accra',
    town: 'Accra',
    websiteUrl: 'https://acity.edu.gh',
  }),
  chartered({
    slug: 'accra-metropolitan-university',
    name: 'Accra Metropolitan University',
    shortName: 'Accra Met',
    region: 'greater_accra',
    town: 'Accra',
    websiteUrl: 'https://accramet.edu.gh',
  }),
  chartered({
    slug: 'aucb',
    name: 'African University of Communication and Business',
    shortName: 'AUCB',
    region: 'greater_accra',
    town: 'Accra',
    websiteUrl: 'https://aucb.edu.gh',
  }),
  chartered({
    slug: 'akrofi-christaller-institute',
    name: 'Akrofi-Christaller Institute of Theology, Mission and Culture',
    shortName: 'ACI',
    region: 'eastern',
    town: 'Akropong',
    websiteUrl: 'https://aci.edu.gh',
  }),
  chartered({
    slug: 'all-nations-university',
    name: 'All Nations University',
    shortName: 'ANU',
    region: 'eastern',
    town: 'Koforidua',
    websiteUrl: 'https://anu.edu.gh',
  }),
  chartered({
    slug: 'ashesi-university',
    name: 'Ashesi University',
    shortName: null,
    region: 'eastern',
    town: 'Berekuso',
    websiteUrl: 'https://ashesi.edu.gh',
  }),
  chartered({
    slug: 'catholic-university-of-ghana',
    name: 'Catholic University of Ghana',
    shortName: 'CUG',
    region: 'bono',
    town: 'Fiapre, Sunyani',
    websiteUrl: 'https://cug.edu.gh',
    nameNote: 'Listed by GTEC as "Catholic University"; full name from its official website.',
  }),
  chartered({
    slug: 'central-university',
    name: 'Central University',
    shortName: null,
    region: 'greater_accra',
    town: 'Tema',
    websiteUrl: 'https://central.edu.gh',
  }),
  chartered({
    slug: 'christian-service-university',
    name: 'Christian Service University',
    shortName: 'CSU',
    region: 'ashanti',
    town: 'Kumasi',
    websiteUrl: 'https://csuc.edu.gh',
  }),
  chartered({
    slug: 'ensign-global-university',
    name: 'Ensign Global University',
    shortName: null,
    region: 'eastern',
    town: 'Kpong',
    websiteUrl: 'https://ensign.edu.gh',
  }),
  chartered({
    slug: 'entrance-university-of-health-sciences',
    name: 'Entrance University of Health Sciences',
    shortName: null,
    region: 'greater_accra',
    town: 'Spintex, Accra',
    websiteUrl: 'https://euhs.edu.gh',
  }),
  chartered({
    slug: 'family-health-university',
    name: 'Family Health University',
    shortName: null,
    region: 'greater_accra',
    town: 'Teshie, Accra',
    websiteUrl: 'https://fhu.edu.gh',
  }),
  chartered({
    slug: 'garden-city-university',
    name: 'Garden City University',
    shortName: 'GCU',
    region: 'ashanti',
    town: 'Kumasi',
    websiteUrl: 'https://gcu.edu.gh',
  }),
  chartered({
    slug: 'heritage-christian-university',
    name: 'Heritage Christian University',
    shortName: null,
    region: 'greater_accra',
    town: 'Amasaman',
    websiteUrl: 'https://hcu.edu.gh',
  }),
  chartered({
    slug: 'kaaf-university',
    name: 'KAAF University',
    shortName: null,
    region: 'central',
    town: 'Fetteh Kakraba',
    websiteUrl: 'https://kaafuni.edu.gh',
  }),
  chartered({
    slug: 'knutsford-university',
    name: 'Knutsford University',
    shortName: null,
    region: 'greater_accra',
    town: 'East Legon, Accra',
    websiteUrl: 'https://knutsford.edu.gh',
    nameNote: 'Listed by GTEC as "KNUTSFORD University"; capitalised as on its official website.',
  }),
  chartered({
    slug: 'methodist-university-ghana',
    name: 'Methodist University Ghana',
    shortName: 'MUG',
    region: 'greater_accra',
    town: 'Accra',
    websiteUrl: 'https://mug.edu.gh',
    nameNote: 'Listed by GTEC as "Methodist University"; full name from its official website.',
  }),
  chartered({
    slug: 'nibs-university',
    name: 'Nobel International Business University',
    shortName: 'NiBS',
    region: 'greater_accra',
    town: 'South Legon, Accra',
    websiteUrl: 'https://nibs.edu.gh',
    nameNote: 'Listed by GTEC as "NiBS University"; full name from its official website.',
  }),
  chartered({
    slug: 'pentecost-university',
    name: 'Pentecost University',
    shortName: null,
    region: 'greater_accra',
    town: 'Sowutuom, Accra',
    websiteUrl: 'https://pentvars.edu.gh',
  }),
  chartered({
    slug: 'presbyterian-university',
    name: 'Presbyterian University',
    shortName: null,
    region: 'eastern',
    town: 'Abetifi',
    websiteUrl: 'https://presbyuniversity.edu.gh',
  }),
  chartered({
    slug: 'thrivus-university',
    name: 'Thrivus University for Biomedical Science and Technology',
    shortName: null,
    region: 'greater_accra',
    town: 'Lashibi',
    websiteUrl: 'https://thrivusinstitute.edu.gh',
  }),
  chartered({
    slug: 'trinity-theological-seminary',
    name: 'Trinity Theological Seminary',
    shortName: null,
    region: 'greater_accra',
    town: 'East Legon, Accra',
    websiteUrl: 'https://trinity.edu.gh',
  }),
  chartered({
    slug: 'university-of-gold-coast',
    name: 'University of Gold Coast',
    shortName: 'UGC',
    region: 'greater_accra',
    town: 'Spintex, Accra',
    websiteUrl: 'https://ugc.edu.gh',
  }),
  chartered({
    slug: 'valley-view-university',
    name: 'Valley View University',
    shortName: 'VVU',
    region: 'greater_accra',
    town: 'Oyibi',
    websiteUrl: 'https://vvu.edu.gh',
  }),

  // ---------- GTEC: Private University ----------
  {
    slug: 'senes-professional-college',
    name: 'SENES Professional College, Accra',
    shortName: null,
    institutionType: 'private_university',
    region: 'greater_accra',
    town: 'Tema',
    // No official website could be found.
    websiteUrl: null,
    gtecCategory: 'Private University',
    nameNote:
      'Listed by GTEC in capitals ("SENES PROFESSIONAL COLLEGE, ACCRA"); accredited 22 July 2026 to 21 July 2029.',
  },
];
