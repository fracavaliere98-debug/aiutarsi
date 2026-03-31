import {
  normalizeBirthDateInput,
  birthDateToIso,
  isoToBirthDateLabel,
  isAdult,
  validateVolunteerDemographics,
} from "../utils/profileDemographics";

const NOW = new Date("2026-03-31T12:00:00.000Z");

const cases = [
  {
    name: "Normalize typed date",
    run: () => normalizeBirthDateInput("01011990") === "01/01/1990",
  },
  {
    name: "Reject invalid date",
    run: () => birthDateToIso("31/02/2000") === null,
  },
  {
    name: "Roundtrip iso label",
    run: () => isoToBirthDateLabel("1990-01-15") === "15/01/1990",
  },
  {
    name: "Adult validation true at 18+",
    run: () => isAdult("2000-01-15", NOW) === true,
  },
  {
    name: "Adult validation false under 18",
    run: () => isAdult("2010-04-01", NOW) === false,
  },
  {
    name: "Onboarding requires gender",
    run: () => {
      const result = validateVolunteerDemographics({
        gender: "",
        birthDateInput: "01/01/1990",
        now: NOW,
      });
      return !result.ok && result.error.includes("sesso");
    },
  },
  {
    name: "Onboarding requires valid birth date",
    run: () => {
      const result = validateVolunteerDemographics({
        gender: "FEMALE",
        birthDateInput: "99/99/9999",
        now: NOW,
      });
      return !result.ok && result.error.includes("data di nascita");
    },
  },
  {
    name: "Onboarding blocks underage user",
    run: () => {
      const result = validateVolunteerDemographics({
        gender: "FEMALE",
        birthDateInput: "01/04/2010",
        now: NOW,
      });
      return !result.ok && result.error.includes("18 anni");
    },
  },
  {
    name: "Onboarding accepts valid adult demographics",
    run: () => {
      const result = validateVolunteerDemographics({
        gender: "MALE",
        birthDateInput: "15/01/1990",
        now: NOW,
      });
      return result.ok && result.gender === "MALE" && result.dateOfBirth === "1990-01-15";
    },
  },
  {
    name: "Settings keep immutable existing values",
    run: () => {
      const result = validateVolunteerDemographics({
        gender: "",
        birthDateInput: "",
        existingGender: "OTHER",
        existingDateOfBirth: "1992-05-02",
        now: NOW,
      });
      return result.ok && result.gender === "OTHER" && result.dateOfBirth === "1992-05-02";
    },
  },
];

let failures = 0;

for (const testCase of cases) {
  const ok = testCase.run();
  if (!ok) {
    failures += 1;
    console.error(`FAIL: ${testCase.name}`);
  } else {
    console.log(`PASS: ${testCase.name}`);
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log("All profile demographics tests passed.");
