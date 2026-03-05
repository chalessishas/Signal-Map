import { addDays, set } from "date-fns";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function atHour(dayOffset: number, hour: number, minute = 0): Date {
  const base = addDays(new Date(), dayOffset);
  return set(base, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
}

const UNC_BUILDINGS = [
  // North Campus — coordinates from OSM
  { name: "Student Union", lat: 35.909998, lng: -79.047607, campus: "NORTH", description: "Hub for student life with dining, meeting rooms, and event spaces.", aliases: ["Student Union", "Carolina Union", "Frank Porter Graham Student Union", "FPG", "Graham Student Union", "Union 2502", "Union 3201", "Union"] },
  { name: "Wilson Library", lat: 35.90951, lng: -79.049759, campus: "NORTH", description: "Historic library housing rare books and special collections.", aliases: ["Wilson Library", "Louis Round Wilson Library"] },
  { name: "South Building", lat: 35.91073, lng: -79.05016, campus: "NORTH", description: "Iconic 1814 building home to the Chancellor's office.", aliases: ["South Building", "South Bldg"] },
  { name: "Memorial Hall", lat: 35.911176, lng: -79.052054, campus: "NORTH", description: "Premier performing arts venue seating 1,400+.", aliases: ["Memorial Hall", "UNC Memorial Hall"] },
  { name: "Morehead Planetarium", lat: 35.913928, lng: -79.050504, campus: "NORTH", description: "Science center with a full-dome digital planetarium.", aliases: ["Morehead Planetarium", "Morehead", "Morehead Planetarium and Science Center"] },
  { name: "Gerrard Hall", lat: 35.911515, lng: -79.051554, campus: "NORTH", description: "Lecture and event hall on historic McCorkle Place.", aliases: ["Gerrard Hall"] },
  { name: "Hamilton Hall", lat: 35.911632, lng: -79.048788, campus: "NORTH", description: "Home to the History and Political Science departments.", aliases: ["Hamilton Hall"] },
  { name: "Greenlaw Hall", lat: 35.91038, lng: -79.049264, campus: "NORTH", description: "Houses the English and Comparative Literature department.", aliases: ["Greenlaw Hall", "Greenlaw"] },
  { name: "Hanes Art Center", lat: 35.912324, lng: -79.054424, campus: "NORTH", description: "Studio art building with galleries and classroom spaces.", aliases: ["Hanes Art Center", "Hanes Art", "Art Center"] },
  { name: "Person Hall", lat: 35.91181, lng: -79.04926, campus: "NORTH", description: "One of UNC's oldest buildings, used for classes and offices.", aliases: ["Person Hall"] },
  { name: "Phillips Hall", lat: 35.910634, lng: -79.052697, campus: "NORTH", description: "Home to the Mathematics department.", aliases: ["Phillips Hall", "Phillips"] },
  { name: "Peabody Hall", lat: 35.910612, lng: -79.053577, campus: "NORTH", description: "Houses the School of Education.", aliases: ["Peabody Hall", "Peabody"] },
  { name: "Carroll Hall", lat: 35.910247, lng: -79.051785, campus: "NORTH", description: "Home to the Hussman School of Journalism and Media.", aliases: ["Carroll Hall", "Hussman School of Journalism"] },
  { name: "Dey Hall", lat: 35.909829, lng: -79.050781, campus: "NORTH", description: "Classroom building with the popular Toy Lounge study space.", aliases: ["Dey Hall", "Toy Lounge"] },
  { name: "Alumni Hall", lat: 35.913173, lng: -79.051019, campus: "NORTH", description: "Historic building used for offices and small events.", aliases: ["Alumni Hall", "Alumni Building"] },
  { name: "Graham Memorial", lat: 35.914089, lng: -79.051663, campus: "NORTH", description: "Student gathering space at the north end of Polk Place.", aliases: ["Graham Memorial", "Graham Memorial Hall"] },
  { name: "Playmakers Theatre", lat: 35.91121, lng: -79.04971, campus: "NORTH", description: "Historic 1851 theater and home to PlayMakers Repertory.", aliases: ["Playmakers Theatre", "PlayMakers Repertory Company", "Historic Playmakers Theatre"] },

  // South Campus / Mid Campus
  { name: "Davis Library", lat: 35.910804, lng: -79.047745, campus: "SOUTH", description: "Main research library with 8 floors and 24/7 study areas.", aliases: ["Davis Library", "Walter Royal Davis Library", "Davis"] },
  { name: "Undergraduate Library", lat: 35.90930, lng: -79.04812, campus: "SOUTH", description: "Popular study spot with group rooms and a media center.", aliases: ["Undergraduate Library", "UL", "The UL", "House Undergraduate Library"] },
  { name: "Genome Sciences Building", lat: 35.907586, lng: -79.050939, campus: "SOUTH", description: "Research facility for genomics and bioinformatics.", aliases: ["Genome Sciences Building", "GSB", "Genome Sciences"] },
  { name: "Kenan-Flagler Business School", lat: 35.90577, lng: -79.04616, campus: "SOUTH", description: "Top-ranked business school with MBA and undergraduate programs.", aliases: ["Kenan-Flagler", "KFBS", "Business School", "Kenan-Flagler Business School"] },
  { name: "Fetzer Hall", lat: 35.909035, lng: -79.047063, campus: "SOUTH", description: "Gym and fitness facility adjacent to the Student Rec Center.", aliases: ["Fetzer Hall", "Fetzer Gym", "Fetzer", "Fetzer Gymnasium"] },
  { name: "Woollen Gym", lat: 35.909631, lng: -79.04591, campus: "SOUTH", description: "Multi-sport gym with basketball courts and fitness areas.", aliases: ["Woollen Gym", "Woollen Gymnasium", "Woollen"] },
  { name: "Student Recreation Center", lat: 35.909301, lng: -79.047523, campus: "SOUTH", description: "Modern rec center with pools, climbing wall, and weight rooms.", aliases: ["Student Recreation Center", "SRC", "Campus Rec", "Student Rec Center"] },
  { name: "Carmichael Arena", lat: 35.90486, lng: -79.04492, campus: "SOUTH", description: "Arena for volleyball, wrestling, and gymnastics events.", aliases: ["Carmichael Arena", "Carmichael Auditorium"] },
  { name: "Dean E. Smith Center", lat: 35.90475, lng: -79.04670, campus: "SOUTH", description: "21,750-seat arena — home of Tar Heel basketball.", aliases: ["Dean Smith Center", "Smith Center", "Dean Dome", "The Dean Dome"] },
  { name: "Koury Natatorium", lat: 35.90374, lng: -79.04545, campus: "SOUTH", description: "Olympic-class swimming and diving facility.", aliases: ["Koury Natatorium", "Koury", "Natatorium"] },
  { name: "Sitterson Hall", lat: 35.909968, lng: -79.053235, campus: "SOUTH", description: "Home to the Computer Science department.", aliases: ["Sitterson Hall", "Sitterson", "Computer Science Building", "CS Building"] },
  { name: "Brooks Hall", lat: 35.90950, lng: -79.05332, campus: "SOUTH", description: "Computer science building connected to Sitterson Hall.", aliases: ["Brooks Hall", "Brooks Computer Science"] },
  { name: "Chapman Hall", lat: 35.910088, lng: -79.052605, campus: "SOUTH", description: "Houses the Statistics and Operations Research department.", aliases: ["Chapman Hall", "Chapman"] },
  { name: "Murray Hall", lat: 35.909644, lng: -79.051753, campus: "SOUTH", description: "Biology department building with teaching labs.", aliases: ["Murray Hall", "Murray"] },
  { name: "Venable Hall", lat: 35.909686, lng: -79.051419, campus: "SOUTH", description: "Chemistry department with lecture halls and labs.", aliases: ["Venable Hall", "Venable"] },
  { name: "Kenan Labs", lat: 35.908983, lng: -79.051138, campus: "SOUTH", description: "Chemistry research laboratories.", aliases: ["Kenan Labs", "Kenan Laboratories", "William Rand Kenan Junior Laboratory"] },
  { name: "Caudill Labs", lat: 35.90808, lng: -79.05109, campus: "SOUTH", description: "Advanced chemistry research and teaching facility.", aliases: ["Caudill Labs", "Caudill Laboratories"] },
  { name: "Lenoir Dining Hall", lat: 35.910414, lng: -79.048776, campus: "SOUTH", description: "Central campus dining hall near The Pit.", aliases: ["Lenoir Dining Hall", "Lenoir Hall", "Lenoir"] },
  { name: "Chase Hall", lat: 35.90806, lng: -79.04707, campus: "SOUTH", description: "South campus dining hall with multiple food stations.", aliases: ["Chase Hall", "Chase Dining Hall", "Chase"] },

  // Health / Medical Campus
  { name: "Bondurant Hall", lat: 35.906194, lng: -79.052407, campus: "SOUTH", description: "Medical education building for the School of Medicine.", aliases: ["Bondurant Hall", "Bondurant"] },
  { name: "UNC Hospitals", lat: 35.90390, lng: -79.05600, campus: "SOUTH", description: "Major academic medical center and teaching hospital.", aliases: ["UNC Hospitals", "UNC Health", "UNC Medical Center"] },
  { name: "School of Public Health", lat: 35.90570, lng: -79.05510, campus: "SOUTH", description: "Gillings School of Global Public Health.", aliases: ["School of Public Health", "Gillings School", "Gillings"] },

  // Other / Athletics
  { name: "Kenan Stadium", lat: 35.90550, lng: -79.04150, campus: "OTHER", description: "50,500-seat football stadium — home of Tar Heel football.", aliases: ["Kenan Stadium", "Kenan Memorial Stadium"] },
  { name: "Boshamer Stadium", lat: 35.90340, lng: -79.04260, campus: "OTHER", description: "Baseball stadium for the Tar Heels.", aliases: ["Boshamer Stadium", "Boshamer"] },
  { name: "Carolina Performing Arts", lat: 35.91200, lng: -79.05100, campus: "NORTH", description: "Presents world-class performances across multiple venues.", aliases: ["Carolina Performing Arts", "CPA"] },
  { name: "FedEx Global Education Center", lat: 35.90703, lng: -79.04920, campus: "SOUTH", description: "Center for global studies with the Mandela Auditorium.", aliases: ["FedEx Global Education Center", "Global Center", "GEC", "FedEx GEC", "Nelson Mandela Auditorium", "Mandela Auditorium"] },
  { name: "Friday Center", lat: 35.89640, lng: -79.01720, campus: "OTHER", description: "Continuing education and conference facility off campus.", aliases: ["Friday Center", "William and Ida Friday Center"] },
  { name: "Stone Center", lat: 35.907767, lng: -79.050224, campus: "SOUTH", description: "Cultural center for Black culture, history, and arts.", aliases: ["Stone Center", "Sonja Haynes Stone Center", "Stone Center for Black Culture and History"] },
  { name: "Campus Y", lat: 35.911394, lng: -79.051214, campus: "NORTH", description: "Student-led social justice and community service hub.", aliases: ["Campus Y", "YMCA Building"] },
  { name: "Carolina Hall", lat: 35.91173, lng: -79.04796, campus: "NORTH", description: "Academic building with classrooms and department offices.", aliases: ["Carolina Hall"] },
  { name: "McCorkle Place", lat: 35.91249, lng: -79.05025, campus: "NORTH", description: "Historic quad surrounded by UNC's oldest buildings.", aliases: ["McCorkle Place"] },
  { name: "Polk Place", lat: 35.91024, lng: -79.04941, campus: "NORTH", description: "Central campus quad between South Building and Wilson Library.", aliases: ["Polk Place"] },
  { name: "The Pit", lat: 35.91010, lng: -79.04720, campus: "NORTH", description: "Outdoor brick plaza — the busiest crossroads on campus.", aliases: ["The Pit", "Pit"] },

  // Additional buildings
  { name: "Hill Hall", lat: 35.912534, lng: -79.053155, campus: "NORTH", description: "Music department with Moeser Auditorium for performances.", aliases: ["Hill Hall", "Moeser Auditorium", "Moeser Auditorium, Hill Hall"] },
  { name: "Ackland Art Museum", lat: 35.912537, lng: -79.054885, campus: "NORTH", description: "University art museum with a collection of 19,000+ works.", aliases: ["Ackland Art Museum", "Ackland", "Ackland Museum"] },
  { name: "Hooker Fields", lat: 35.90397, lng: -79.03988, campus: "OTHER", description: "Outdoor athletic fields for soccer and lacrosse.", aliases: ["Hooker Fields", "Hooker Field"] },
  { name: "Swain Hall", lat: 35.911452, lng: -79.053688, campus: "NORTH", description: "Houses academic departments and classroom spaces.", aliases: ["Swain Hall", "Swain"] },
  { name: "SASB", lat: 35.90475, lng: -79.04830, campus: "SOUTH", description: "Student services center with advising and financial aid.", aliases: ["SASB", "SASB North", "SASB South", "Student Academic Services Building", "Student and Academic Services Building"] },
  { name: "Murphey Hall", lat: 35.91074, lng: -79.049655, campus: "NORTH", description: "Classroom building on Polk Place for humanities courses.", aliases: ["Murphey Hall", "Murphey"] },
  { name: "Gardner Hall", lat: 35.90860, lng: -79.05280, campus: "SOUTH", description: "Houses the Biology department and research labs.", aliases: ["Gardner Hall", "Gardner", "GSU"] },
  { name: "UNC Visitors Center", lat: 35.91220, lng: -79.04680, campus: "NORTH", description: "Welcome center for prospective students and campus tours.", aliases: ["UNC Visitors Center", "Visitors Center", "Visitor Center"] },
  { name: "Kenan Theatre", lat: 35.91140, lng: -79.04620, campus: "NORTH", description: "Theater for dramatic arts productions and classes.", aliases: ["Kenan Theatre", "Kenan Theater", "Kenan 1st Floor", "Kenan"] },
  { name: "Student Wellness", lat: 35.90480, lng: -79.04380, campus: "SOUTH", description: "Campus health services and student wellness programs.", aliases: ["Student Wellness", "Campus Health"] },
  { name: "McColl Building", lat: 35.90560, lng: -79.04580, campus: "SOUTH", description: "Kenan-Flagler graduate programs and executive education.", aliases: ["McColl", "McColl Building", "McColl 2600"] },
  { name: "Old Well", lat: 35.912063, lng: -79.051235, campus: "NORTH", description: "UNC's most iconic landmark and symbol of the university.", aliases: ["Old Well", "The Old Well"] },
  { name: "Loudermilk Center", lat: 35.90590, lng: -79.04280, campus: "SOUTH", description: "Athletic excellence center with academic support for athletes.", aliases: ["Loudermilk Center", "Loudermilk"] },
  { name: "Henry Stadium", lat: 35.90350, lng: -79.04050, campus: "OTHER", description: "Soccer and lacrosse stadium (Dorrance Field).", aliases: ["Henry Stadium", "Dorrance Field", "Henry Field"] },
  { name: "Eddie Smith Field House", lat: 35.90430, lng: -79.04180, campus: "OTHER", description: "Indoor practice facility for multiple varsity sports.", aliases: ["Eddie Smith Field House", "Eddie Smith", "Field House"] },
  { name: "Rams Head", lat: 35.90550, lng: -79.04350, campus: "SOUTH", description: "Recreation center and dining complex on south campus.", aliases: ["Rams Head", "Rams Head Recreation Center", "Rams Head Dining", "Ram's Head"] },
  { name: "Bingham Hall", lat: 35.91056, lng: -79.04867, campus: "NORTH", description: "Classroom building near Polk Place for liberal arts.", aliases: ["Bingham Hall", "Bingham"] },
  { name: "Manning Hall", lat: 35.90930, lng: -79.05030, campus: "SOUTH", description: "Home to the School of Information and Library Science.", aliases: ["Manning Hall", "Manning"] },
  { name: "New West", lat: 35.91046, lng: -79.05170, campus: "NORTH", description: "Academic building housing offices and seminar rooms.", aliases: ["New West", "New West Building"] },
  { name: "Coker Hall", lat: 35.90950, lng: -79.05410, campus: "SOUTH", description: "Biology research building with herbarium collections.", aliases: ["Coker Hall", "Coker"] },

  // Buildings added for better event matching
  { name: "Health Sciences Library", lat: 35.90020, lng: -79.05350, campus: "OTHER", description: "Library serving the health affairs schools and UNC Health.", aliases: ["Health Sciences Library", "HSL", "Health Science Library"] },
  { name: "Rosenau Hall", lat: 35.90060, lng: -79.05290, campus: "OTHER", description: "Public health classrooms and research offices.", aliases: ["Rosenau Hall", "Rosenau", "Gillings School"] },
  { name: "Howell Hall", lat: 35.90910, lng: -79.05510, campus: "SOUTH", description: "Science building with labs and lecture rooms.", aliases: ["Howell Hall", "Howell"] },
  { name: "Hanes Hall", lat: 35.90950, lng: -79.05220, campus: "SOUTH", description: "Houses the Psychology and Neuroscience department.", aliases: ["Hanes Hall", "Hanes"] },
  { name: "Hyde Hall", lat: 35.91280, lng: -79.05020, campus: "NORTH", description: "Home to the Institute for Arts and Humanities.", aliases: ["Hyde Hall", "Hyde", "Institute for Arts and Humanities"] },
  { name: "Bell Hall", lat: 35.91020, lng: -79.05300, campus: "SOUTH", description: "Academic building near the Bell Tower landmark.", aliases: ["Bell Hall", "Bell Tower", "The Bell Tower"] },
  { name: "Kerr Hall", lat: 35.90040, lng: -79.05180, campus: "OTHER", description: "Home to the Eshelman School of Pharmacy.", aliases: ["Kerr Hall", "Eshelman School of Pharmacy", "Pharmacy"] },
  { name: "George Watts Hill Alumni Center", lat: 35.90600, lng: -79.04470, campus: "SOUTH", description: "Alumni association headquarters and event venue.", aliases: ["Alumni Center", "George Watts Hill Alumni Center", "Watts Hill"] },
  { name: "Carolina Club", lat: 35.90580, lng: -79.04420, campus: "SOUTH", description: "Private faculty and alumni club with dining and event rooms.", aliases: ["Carolina Club", "The Carolina Club"] },
  { name: "Friday Conference Center", lat: 35.89640, lng: -79.01720, campus: "OTHER", description: "Conference and professional development facility.", aliases: ["Friday Conference Center", "Friday Center Conference"] },
  { name: "Genetic Medicine Building", lat: 35.90360, lng: -79.05370, campus: "OTHER", description: "Research facility for genetic and personalized medicine.", aliases: ["Genetic Medicine Building", "Genetic Medicine", "GMB"] },
  { name: "Tate-Turner-Kuralt Building", lat: 35.90780, lng: -79.05290, campus: "SOUTH", description: "Home to the School of Social Work.", aliases: ["Tate-Turner-Kuralt", "TTK", "School of Social Work"] },
  { name: "North Carolina Botanical Garden", lat: 35.89890, lng: -79.03400, campus: "OTHER", description: "Conservation garden with native southeastern plant collections.", aliases: ["NC Botanical Garden", "Botanical Garden", "North Carolina Botanical Garden"] },
  { name: "Craige Residence Hall", lat: 35.90610, lng: -79.05070, campus: "SOUTH", description: "South campus residence hall for undergraduates.", aliases: ["Craige Residence Hall", "Craige"] },
  { name: "Varsity Theatre", lat: 35.91340, lng: -79.05590, campus: "NORTH", description: "Historic cinema on Franklin Street, now an event venue.", aliases: ["Varsity Theatre", "Varsity Theater"] },
  { name: "Mitchell Hall", lat: 35.91035, lng: -79.05440, campus: "SOUTH", description: "Science building with classrooms and teaching labs.", aliases: ["Mitchell Hall", "Mitchell"] },

  // Residence Halls
  { name: "Alderman Residence Hall", lat: 35.914745, lng: -79.048211, campus: "NORTH", description: "Historic north campus residence hall.", aliases: ["Alderman Residence Hall", "Alderman"] },
  { name: "Alexander Residence Hall", lat: 35.911349, lng: -79.046336, campus: "NORTH", description: "North campus residence hall near the Student Union.", aliases: ["Alexander Residence Hall", "Alexander"] },
  { name: "Avery Residence Hall", lat: 35.90621, lng: -79.044233, campus: "SOUTH", description: "Mid campus residence hall on Stadium Drive.", aliases: ["Avery Residence Hall", "Avery"] },
  { name: "Carmichael Residence Hall", lat: 35.908224, lng: -79.045844, campus: "SOUTH", description: "Mid campus dorm near Woollen Gym.", aliases: ["Carmichael Residence Hall", "Carmichael"] },
  { name: "Cobb Residence Hall", lat: 35.91234, lng: -79.044725, campus: "NORTH", description: "North campus residence hall near Cobb Deck.", aliases: ["Cobb Residence Hall", "Cobb"] },
  { name: "Connor Residence Hall", lat: 35.91290, lng: -79.04580, campus: "NORTH", description: "Historic north campus residence hall.", aliases: ["Connor Residence Hall", "Connor"] },
  { name: "Craige North Residence Hall", lat: 35.90346, lng: -79.045752, campus: "SOUTH", description: "South campus first-year housing.", aliases: ["Craige North Residence Hall", "Craige North"] },
  { name: "Ehringhaus Residence Hall", lat: 35.904369, lng: -79.042902, campus: "SOUTH", description: "Large south campus first-year dorm.", aliases: ["Ehringhaus Residence Hall", "Ehringhaus"] },
  { name: "Everett Residence Hall", lat: 35.912629, lng: -79.046385, campus: "NORTH", description: "North campus residence hall near Cobb Deck.", aliases: ["Everett Residence Hall", "Everett"] },
  { name: "Graham Residence Hall", lat: 35.913018, lng: -79.046697, campus: "NORTH", description: "North campus residence hall.", aliases: ["Graham Residence Hall", "Graham"] },
  { name: "Grimes Residence Hall", lat: 35.912426, lng: -79.04843, campus: "NORTH", description: "North campus residence hall near Davis Library.", aliases: ["Grimes Residence Hall", "Grimes"] },
  { name: "Hinton James Residence Hall", lat: 35.902359, lng: -79.043216, campus: "SOUTH", description: "UNC's largest dorm, housing nearly 1,000 students.", aliases: ["Hinton James Residence Hall", "Hinton James", "HJ"] },
  { name: "Joyner Residence Hall", lat: 35.911687, lng: -79.046705, campus: "NORTH", description: "North campus residence hall.", aliases: ["Joyner Residence Hall", "Joyner"] },
  { name: "Kenan Residence Hall", lat: 35.914602, lng: -79.047491, campus: "NORTH", description: "North campus residence hall built in 1939.", aliases: ["Kenan Residence Hall", "Kenan"] },
  { name: "Khoury Residence Hall", lat: 35.903715, lng: -79.043488, campus: "SOUTH", description: "South campus residence hall (formerly Koury Residence Hall).", aliases: ["Khoury Residence Hall", "Khoury", "Koury"] },
  { name: "Lewis Residence Hall", lat: 35.912404, lng: -79.04697, campus: "NORTH", description: "North campus residence hall near Joyner.", aliases: ["Lewis Residence Hall", "Lewis"] },
  { name: "Mangum Residence Hall", lat: 35.911993, lng: -79.04755, campus: "NORTH", description: "North campus residence hall.", aliases: ["Mangum Residence Hall", "Mangum"] },
  { name: "Manly Residence Hall", lat: 35.912645, lng: -79.04789, campus: "NORTH", description: "North campus residence hall near Grimes.", aliases: ["Manly Residence Hall", "Manly"] },
  { name: "McClinton Residence Hall", lat: 35.912833, lng: -79.047159, campus: "NORTH", description: "North campus residence hall.", aliases: ["McClinton Residence Hall", "McClinton"] },
  { name: "McIver Residence Hall", lat: 35.914061, lng: -79.047824, campus: "NORTH", description: "North campus residence hall built in 1939.", aliases: ["McIver Residence Hall", "McIver"] },
  { name: "Morrison Residence Hall", lat: 35.904513, lng: -79.046187, campus: "SOUTH", description: "10-story south campus residence hall.", aliases: ["Morrison Residence Hall", "Morrison"] },
  { name: "Parker Residence Hall", lat: 35.906973, lng: -79.044379, campus: "SOUTH", description: "Mid campus residence hall on Stadium Drive.", aliases: ["Parker Residence Hall", "Parker"] },
  { name: "Paul Hardin Residence Hall", lat: 35.904043, lng: -79.046006, campus: "SOUTH", description: "South campus residence hall near Morrison.", aliases: ["Paul Hardin Residence Hall", "Paul Hardin", "Hardin"] },
  { name: "Ruffin Residence Hall", lat: 35.911801, lng: -79.04806, campus: "NORTH", description: "North campus residence hall near Carolina Hall.", aliases: ["Ruffin Residence Hall", "Ruffin"] },
  { name: "Spencer Residence Hall", lat: 35.915001, lng: -79.049323, campus: "NORTH", description: "North campus residence hall near Alderman.", aliases: ["Spencer Residence Hall", "Spencer"] },
  { name: "Stacy Residence Hall", lat: 35.912963, lng: -79.046065, campus: "NORTH", description: "North campus residence hall.", aliases: ["Stacy Residence Hall", "Stacy"] },
  { name: "Taylor Hall", lat: 35.901628, lng: -79.043403, campus: "SOUTH", description: "South campus residence hall.", aliases: ["Taylor Hall", "Taylor"] },
  { name: "Teague Residence Hall", lat: 35.90767, lng: -79.045024, campus: "SOUTH", description: "Mid campus residence hall near Parker.", aliases: ["Teague Residence Hall", "Teague"] },
  { name: "Winston Residence Hall", lat: 35.910367, lng: -79.046103, campus: "NORTH", description: "North campus residence hall.", aliases: ["Winston Residence Hall", "Winston"] },
  { name: "Horton Residence Hall", lat: 35.90380, lng: -79.04450, campus: "SOUTH", description: "South campus residence hall.", aliases: ["Horton Residence Hall", "Horton"] },
  { name: "George Moses Residence Hall", lat: 35.903083, lng: -79.043821, campus: "SOUTH", description: "South campus residence hall.", aliases: ["George Moses Residence Hall", "George Moses"] },
  { name: "Ram Village Building 1", lat: 35.902018, lng: -79.045875, campus: "SOUTH", description: "Graduate and family apartment housing.", aliases: ["Ram Village Building 1", "Ram Village 1"] },
  { name: "Ram Village Building 2", lat: 35.901944, lng: -79.046788, campus: "SOUTH", description: "Graduate and family apartment housing.", aliases: ["Ram Village Building 2", "Ram Village 2"] },
  { name: "Ram Village Building 3", lat: 35.902431, lng: -79.046346, campus: "SOUTH", description: "Graduate and family apartment housing.", aliases: ["Ram Village Building 3", "Ram Village 3"] },
  { name: "Granville Towers South", lat: 35.910358, lng: -79.057488, campus: "NORTH", description: "Private residence hall on Franklin Street.", aliases: ["Granville Towers South", "Granville Towers"] },
  { name: "Baity Hill", lat: 35.89889, lng: -79.041521, campus: "OTHER", description: "Graduate and family student housing complex.", aliases: ["Baity Hill"] },

  // Academic & Administrative Buildings
  { name: "Abernathy Hall", lat: 35.911435, lng: -79.054317, campus: "NORTH", description: "Home to the Department of Exercise and Sport Science.", aliases: ["Abernathy Hall", "Abernathy", "Abernethy Hall"] },
  { name: "Battle Hall", lat: 35.913922, lng: -79.053077, campus: "NORTH", description: "Historic building near McCorkle Place.", aliases: ["Battle Hall", "Battle"] },
  { name: "Beard Hall", lat: 35.90689, lng: -79.053452, campus: "SOUTH", description: "School of Dentistry clinical and research facility.", aliases: ["Beard Hall", "Beard"] },
  { name: "Bynum Hall", lat: 35.911718, lng: -79.049768, campus: "NORTH", description: "Houses the Center for Dramatic Art administration.", aliases: ["Bynum Hall", "Bynum"] },
  { name: "Caldwell Hall", lat: 35.912144, lng: -79.049037, campus: "NORTH", description: "Historic building housing the Honors Program.", aliases: ["Caldwell Hall", "Caldwell"] },
  { name: "Davie Hall", lat: 35.912763, lng: -79.049466, campus: "NORTH", description: "Home to the Psychology department offices.", aliases: ["Davie Hall", "Davie", "Davie Poplar"] },
  { name: "Fordham Hall", lat: 35.907301, lng: -79.051591, campus: "SOUTH", description: "Ecology research and classroom building.", aliases: ["Fordham Hall", "Fordham"] },
  { name: "Jackson Hall", lat: 35.91271, lng: -79.045405, campus: "NORTH", description: "Naval ROTC building on north campus.", aliases: ["Jackson Hall", "Jackson"] },
  { name: "Carrington Hall", lat: 35.906707, lng: -79.051795, campus: "SOUTH", description: "School of Dentistry facility.", aliases: ["Carrington Hall", "Carrington"] },
  { name: "Coates Building", lat: 35.915228, lng: -79.051491, campus: "NORTH", description: "UNC Institute of Government.", aliases: ["Coates Building", "Coates", "Knapp-Sanders Building"] },
  { name: "Steele Building", lat: 35.911566, lng: -79.050394, campus: "NORTH", description: "Houses administrative offices and student services.", aliases: ["Steele Building", "Steele"] },
  { name: "Vance Hall", lat: 35.913794, lng: -79.052935, campus: "NORTH", description: "Academic building near McCorkle Place.", aliases: ["Vance Hall", "Vance"] },
  { name: "Pearson Hall", lat: 35.912535, lng: -79.052432, campus: "NORTH", description: "Classroom building near the Bell Tower.", aliases: ["Pearson Hall", "Pearson"] },
  { name: "Pettigrew Hall", lat: 35.913633, lng: -79.052843, campus: "NORTH", description: "Houses administrative offices.", aliases: ["Pettigrew Hall", "Pettigrew"] },
  { name: "Old East", lat: 35.91238, lng: -79.050841, campus: "NORTH", description: "First state university building in the nation, built 1795.", aliases: ["Old East", "Old East Residence Hall"] },
  { name: "Old West", lat: 35.912016, lng: -79.051788, campus: "NORTH", description: "Historic 1823 building on McCorkle Place.", aliases: ["Old West", "Old West Building"] },
  { name: "New East", lat: 35.912707, lng: -79.050254, campus: "NORTH", description: "Academic building near Old East.", aliases: ["New East"] },
  { name: "Kenan Music Building", lat: 35.911815, lng: -79.054507, campus: "NORTH", description: "State-of-the-art music rehearsal and performance facility.", aliases: ["Kenan Music Building", "Kenan Music Center", "Music Building"] },
  { name: "Paul Green Theatre", lat: 35.911989, lng: -79.043848, campus: "NORTH", description: "Home to PlayMakers Repertory Company productions.", aliases: ["Paul Green Theatre", "Paul Green Theater", "Center for Dramatic Art"] },
  { name: "Evergreen Hall", lat: 35.912181, lng: -79.053899, campus: "NORTH", description: "Houses the Global Languages department.", aliases: ["Evergreen Hall", "Evergreen"] },
  { name: "Curtis Media Center", lat: 35.910729, lng: -79.052177, campus: "NORTH", description: "Journalism and media production facility.", aliases: ["Curtis Media Center", "Curtis"] },
  { name: "Henry Owl Building", lat: 35.912232, lng: -79.049665, campus: "NORTH", description: "Houses the American Indian Center.", aliases: ["Henry Owl Building", "Henry Owl"] },
  { name: "Whitehead Hall", lat: 35.908916, lng: -79.053705, campus: "SOUTH", description: "Biomedical engineering labs and classrooms.", aliases: ["Whitehead Hall", "Whitehead"] },
  { name: "Wilson Hall", lat: 35.908051, lng: -79.051913, campus: "SOUTH", description: "Biology teaching laboratories.", aliases: ["Wilson Hall"] },
  { name: "Morehead Laboratory", lat: 35.908919, lng: -79.051825, campus: "SOUTH", description: "Chemistry research lab building.", aliases: ["Morehead Laboratory", "Morehead Lab"] },

  // Medical & Health Sciences
  { name: "Burnett Womack Building", lat: 35.904933, lng: -79.052229, campus: "OTHER", description: "Clinical building for UNC School of Medicine.", aliases: ["Burnett Womack Building", "Burnett-Womack", "Burnett Womack"] },
  { name: "MacNider Hall", lat: 35.90544, lng: -79.052614, campus: "SOUTH", description: "Medical school building opened in 1939.", aliases: ["MacNider Hall", "MacNider"] },
  { name: "Brinkhous-Bullitt Building", lat: 35.905905, lng: -79.05166, campus: "SOUTH", description: "Pathology and laboratory medicine facility.", aliases: ["Brinkhous-Bullitt Building", "Brinkhous-Bullitt"] },
  { name: "Lineberger Cancer Center", lat: 35.903037, lng: -79.053584, campus: "OTHER", description: "UNC Lineberger Comprehensive Cancer Center.", aliases: ["Lineberger Cancer Center", "Lineberger"] },
  { name: "Marsico Hall", lat: 35.902571, lng: -79.053829, campus: "OTHER", description: "Biomedical research building opened in 2016.", aliases: ["Marsico Hall", "Marsico"] },
  { name: "Thurston Bowles Building", lat: 35.903909, lng: -79.054324, campus: "OTHER", description: "Biomedical research laboratory.", aliases: ["Thurston Bowles Building", "Thurston Bowles"] },
  { name: "Michael Hooker Research Center", lat: 35.905383, lng: -79.054254, campus: "OTHER", description: "Biomedical and translational research facility.", aliases: ["Michael Hooker Research Center", "Hooker Research Center", "Hooker Research"] },
  { name: "N.C. Cancer Hospital", lat: 35.903682, lng: -79.049437, campus: "OTHER", description: "North Carolina Cancer Hospital treating patients statewide.", aliases: ["NC Cancer Hospital", "N.C. Cancer Hospital", "Cancer Hospital"] },
  { name: "McGavran-Greenberg Hall", lat: 35.906182, lng: -79.054416, campus: "SOUTH", description: "Public health research and teaching building.", aliases: ["McGavran-Greenberg Hall", "McGavran-Greenberg"] },
  { name: "Taylor Student Health Center", lat: 35.905886, lng: -79.049468, campus: "SOUTH", description: "Campus student health services clinic.", aliases: ["Taylor Student Health Center", "Campus Health", "Student Health"] },
  { name: "Bioinformatics Building", lat: 35.901703, lng: -79.053314, campus: "OTHER", description: "Computational biology and bioinformatics research.", aliases: ["Bioinformatics Building", "Bioinformatics"] },
  { name: "Mary Ellen Jones Building", lat: 35.903666, lng: -79.053418, campus: "OTHER", description: "Biochemistry and biophysics research.", aliases: ["Mary Ellen Jones Building", "MEJ Building"] },
  { name: "Roper Hall", lat: 35.90628, lng: -79.051418, campus: "SOUTH", description: "School of Dentistry research building.", aliases: ["Roper Hall", "Roper"] },

  // Athletics & Recreation
  { name: "Stallings-Evans Sports Medicine Center", lat: 35.908937, lng: -79.046184, campus: "SOUTH", description: "Sports medicine and athletic training facility.", aliases: ["Stallings-Evans Sports Medicine Centre", "Stallings-Evans", "Sports Medicine Center"] },
  { name: "McCaskill Soccer Center", lat: 35.908929, lng: -79.045332, campus: "SOUTH", description: "Indoor soccer practice facility.", aliases: ["McCaskill Soccer Center", "McCaskill"] },
  { name: "Bill Koman Practice Complex", lat: 35.908048, lng: -79.043729, campus: "OTHER", description: "Football outdoor practice fields.", aliases: ["Bill Koman Practice Complex", "Koman Practice Complex"] },
  { name: "Outdoor Education Center", lat: 35.906992, lng: -79.03837, campus: "OTHER", description: "Outdoor adventure and education programs.", aliases: ["Outdoor Education Center", "OEC"] },

  // Other Campus Landmarks
  { name: "The Carolina Inn", lat: 35.909804, lng: -79.054412, campus: "NORTH", description: "Historic hotel on campus, built in 1924.", aliases: ["The Carolina Inn", "Carolina Inn"] },
  { name: "UNC Student Stores", lat: 35.909858, lng: -79.048321, campus: "SOUTH", description: "Campus bookstore and merchandise shop.", aliases: ["UNC Student Stores", "Student Stores", "Daniels Student Stores"] },
  { name: "Morehead-Patterson Bell Tower", lat: 35.908607, lng: -79.049216, campus: "SOUTH", description: "167-foot bell tower and campus landmark.", aliases: ["Morehead-Patterson Bell Tower", "Bell Tower", "The Bell Tower"] },
  { name: "UNC Public Safety Building", lat: 35.904064, lng: -79.04722, campus: "SOUTH", description: "Campus police and public safety headquarters.", aliases: ["UNC Public Safety Building", "Public Safety", "Campus Police"] },
  { name: "ROTC Building", lat: 35.9091, lng: -79.052891, campus: "SOUTH", description: "Reserve Officers' Training Corps facility.", aliases: ["ROTC", "ROTC Building", "Naval Armory"] },
  { name: "Hickerson House", lat: 35.915269, lng: -79.047911, campus: "NORTH", description: "Historic house on campus, now office space.", aliases: ["Hickerson House", "Hickerson"] },
  { name: "Wallace Plaza", lat: 35.914632, lng: -79.054031, campus: "NORTH", description: "Outdoor gathering space near Wallace Parking Deck.", aliases: ["Wallace Plaza"] },
];

async function main() {
  await prisma.ingestLog.deleteMany();
  await prisma.event.deleteMany();
  await prisma.eventSource.deleteMany();
  await prisma.building.deleteMany();

  const buildings: Awaited<ReturnType<typeof prisma.building.create>>[] = [];
  for (const b of UNC_BUILDINGS) {
    const created = await prisma.building.create({
      data: {
        name: b.name,
        description: b.description ?? null,
        lat: b.lat,
        lng: b.lng,
        campus: b.campus,
        aliases: JSON.stringify(b.aliases),
      },
    });
    buildings.push(created);
  }

  const officialSource = await prisma.eventSource.create({
    data: {
      name: "UNC Heel Life",
      url: "https://heellife.unc.edu/events",
      parserType: "HEELLIFE",
      lastSuccessAt: new Date(),
    },
  });

  // Additional event sources — parsers auto-dispatch based on parserType
  await prisma.eventSource.createMany({
    data: [
      {
        name: "UNC Events Calendar",
        url: "https://calendar.unc.edu",
        parserType: "LOCALIST",
      },
      {
        name: "Carolina Performing Arts",
        url: "https://carolinaperformingarts.org",
        parserType: "WP_EVENTS",
      },
      {
        name: "UNC Libraries",
        url: "https://calendar.lib.unc.edu/ical_subscribe.php?src=p&cid=2998",
        parserType: "ICAL_LIBRARIES",
      },
      {
        name: "UNC Athletics",
        url: "https://move.unc.edu/calendar/category/athletics/?ical=1",
        parserType: "ICAL_ATHLETICS",
      },
    ],
  });

  const findBuilding = (name: string) =>
    buildings.find((b) => b.name === name)!;

  await prisma.event.createMany({
    data: [
      {
        sourceId: "seed-001",
        title: "Carolina Night: Movie Screening",
        description: "Student org weekly film screening event in the Union auditorium.",
        startTime: atHour(0, 19, 0),
        endTime: atHour(0, 21, 0),
        buildingId: findBuilding("Student Union").id,
        locationText: "Student Union Auditorium",
        organizer: "Carolina Union Activities Board",
        category: "Social",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-002",
        title: "AI Talk: Multimodal Systems",
        description: "Open lecture hosted by the CS department on recent advances in multimodal AI.",
        startTime: atHour(1, 14, 0),
        endTime: atHour(1, 16, 0),
        buildingId: findBuilding("Sitterson Hall").id,
        locationText: "Sitterson Hall, Room 014",
        organizer: "UNC Computer Science",
        category: "Academic",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-003",
        title: "Late Night Study Session",
        description: "Extended study hours with free snacks and peer tutoring available.",
        startTime: atHour(0, 18, 0),
        endTime: atHour(0, 23, 59),
        buildingId: findBuilding("Davis Library").id,
        locationText: "Davis Library, Floor 3",
        organizer: "University Libraries",
        category: "Academic",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-004",
        title: "Basketball Game Watch Party",
        description: "Come watch the Tar Heels play on the big screen!",
        startTime: atHour(1, 19, 0),
        endTime: atHour(1, 22, 0),
        buildingId: findBuilding("Student Union").id,
        locationText: "Student Union, Great Hall",
        organizer: "Carolina Union",
        category: "Social",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-005",
        title: "Yoga on the Quad",
        description: "Free outdoor yoga session. Bring your own mat!",
        startTime: atHour(2, 8, 0),
        endTime: atHour(2, 9, 0),
        buildingId: findBuilding("Polk Place").id,
        locationText: "Polk Place Quad",
        organizer: "Campus Recreation",
        category: "Fitness",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-006",
        title: "Career Fair: Tech & Engineering",
        description: "Meet recruiters from top tech companies. Bring your resume!",
        startTime: atHour(2, 10, 0),
        endTime: atHour(2, 16, 0),
        buildingId: findBuilding("FedEx Global Education Center").id,
        locationText: "FedEx Global Education Center, Nelson Mandela Auditorium",
        organizer: "UNC Career Services",
        category: "Career",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
      {
        sourceId: "seed-007",
        title: "Open Mic Night",
        description: "Perform poetry, comedy, music, or anything else at the Stone Center.",
        startTime: atHour(1, 20, 0),
        endTime: atHour(1, 22, 30),
        buildingId: findBuilding("Stone Center").id,
        locationText: "Stone Center, Hitchcock Multipurpose Room",
        organizer: "Stone Center Programming",
        category: "Arts",
        status: "ACTIVE",
        sourceRef: officialSource.id,
      },
    ],
  });

  await prisma.ingestLog.create({
    data: {
      sourceId: officialSource.id,
      runAt: new Date(),
      newCount: 7,
      updatedCount: 0,
      errorCount: 0,
    },
  });

  console.log(`Seeded ${buildings.length} buildings and 7 events.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
