/**
 * Pre-generated 50-row graduating student cohort for batch issuance demonstration
 */

export interface BatchCandidateRow {
  index: number;
  studentName: string;
  studentId: string;
  degreeCode: number;
  degreeName: string;
  programCode: number;
  programName: string;
  graduationYear: number;
  cgpa: number;
  holderAddress: string;
}

const FIRST_NAMES = [
  'Aria', 'Liam', 'Maya', 'Ethan', 'Zoe', 'Lucas', 'Nia', 'Oliver', 'Elena', 'Noah',
  'Tara', 'Mason', 'Chloe', 'James', 'Kavya', 'Logan', 'Sofia', 'Alexander', 'Meera', 'Benjamin',
  'Layla', 'Henry', 'Amara', 'Sebastian', 'Ananya', 'Jack', 'Mila', 'Samuel', 'Rohan', 'Daniel',
  'Siddharth', 'William', 'Diya', 'Matthew', 'Aarav', 'David', 'Isha', 'Joseph', 'Aditya', 'Carter',
  'Anika', 'Owen', 'Vikram', 'Wyatt', 'Pooja', 'John', 'Tanvi', 'Luke', 'Neha', 'Julian'
];

const LAST_NAMES = [
  'Vance', 'Patel', 'Mercer', 'Chen', 'Sharma', 'Davies', 'Kaur', 'Nakamoto', 'Reddy', 'Wright',
  'Iyer', 'Sterling', 'Gupta', 'Sinclair', 'Mehta', 'Campbell', 'Verma', 'Hastings', 'Joshi', 'Montgomery',
  'Bose', 'Adler', 'Chopra', 'Fletcher', 'Deshmukh', 'Elliot', 'Banerjee', 'Hayes', 'Nair', 'Thornton',
  'Sen', 'Kaufman', 'Mukherjee', 'Davenport', 'Rao', 'Vogel', 'Bhat', 'Winslow', 'Saxena', 'Donovan',
  'Mishra', 'Holt', 'Malhotra', 'Barrett', 'Ghosh', 'Prescott', 'Kulkarni', 'Rowe', 'Das', 'Whitaker'
];

const PROGRAMS = [
  { code: 101, name: 'Computer Science & Engineering', degreeCode: 1, degreeName: 'B.Tech' },
  { code: 102, name: 'Electrical & Electronics', degreeCode: 1, degreeName: 'B.Tech' },
  { code: 103, name: 'Mechanical Systems', degreeCode: 1, degreeName: 'B.Tech' },
  { code: 104, name: 'Information Technology', degreeCode: 1, degreeName: 'B.Tech' },
  { code: 105, name: 'Machine Intelligence & Data Science', degreeCode: 2, degreeName: 'M.Tech' },
  { code: 106, name: 'Computational Mathematics', degreeCode: 3, degreeName: 'B.Sc' },
  { code: 107, name: 'Quantum Information Science', degreeCode: 5, degreeName: 'Ph.D' },
];

export function getSample50BatchCandidates(): BatchCandidateRow[] {
  const cohort: BatchCandidateRow[] = [];

  for (let i = 0; i < 50; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const ln = LAST_NAMES[i % LAST_NAMES.length]!;
    const prog = PROGRAMS[i % PROGRAMS.length]!;
    
    // Deterministic CGPA between 7.40 and 9.95
    const cgpa = Number((7.40 + ((i * 17) % 255) / 100).toFixed(2));
    
    // Simulated holder address based on index
    const hexIndex = (i + 1).toString(16).padStart(4, '0');
    const holderAddress = `0x3C44CdDdB6a900fa2b585dd299e03d12FA42${hexIndex}`;

    cohort.push({
      index: i + 1,
      studentName: `${fn} ${ln}`,
      studentId: `NF2026-${(1001 + i).toString()}`,
      degreeCode: prog.degreeCode,
      degreeName: prog.degreeName,
      programCode: prog.code,
      programName: prog.name,
      graduationYear: 2026,
      cgpa: Math.min(cgpa, 9.95),
      holderAddress,
    });
  }

  return cohort;
}

export function generateBatchCsvString(candidates: BatchCandidateRow[]): string {
  const header = 'Index,StudentName,StudentID,DegreeCode,DegreeName,ProgramCode,ProgramName,GraduationYear,CGPA,HolderAddress';
  const rows = candidates.map(
    (c) =>
      `${c.index},"${c.studentName}",${c.studentId},${c.degreeCode},${c.degreeName},${c.programCode},"${c.programName}",${c.graduationYear},${c.cgpa},${c.holderAddress}`,
  );
  return [header, ...rows].join('\n');
}
