/**
 * 2026 FIFA World Cup Group Stage Schedule.
 * All times in ET. Source: FIFA official schedule.
 */

export interface GroupMatch {
  matchNum: number;
  group: string;
  home: string;  // WC name (may be placeholder like "__UEFA_D__")
  away: string;
  date: string;  // e.g. "Jun 11"
  time: string;  // ET, e.g. "3:00 PM"
  venue: string;
  city: string;
}

export const GROUP_STAGE_SCHEDULE: GroupMatch[] = [
  // GROUP A
  { matchNum: 1, group: "A", home: "Mexico", away: "South Africa", date: "Jun 11", time: "3:00 PM", venue: "Estadio Azteca", city: "Mexico City" },
  { matchNum: 2, group: "A", home: "Korea Republic", away: "__UEFA_D__", date: "Jun 11", time: "10:00 PM", venue: "Estadio Akron", city: "Guadalajara" },
  { matchNum: 15, group: "A", home: "__UEFA_D__", away: "South Africa", date: "Jun 18", time: "12:00 PM", venue: "Mercedes-Benz Stadium", city: "Atlanta" },
  { matchNum: 16, group: "A", home: "Mexico", away: "Korea Republic", date: "Jun 18", time: "9:00 PM", venue: "Estadio Akron", city: "Guadalajara" },
  { matchNum: 37, group: "A", home: "__UEFA_D__", away: "Mexico", date: "Jun 24", time: "9:00 PM", venue: "Estadio Azteca", city: "Mexico City" },
  { matchNum: 38, group: "A", home: "South Africa", away: "Korea Republic", date: "Jun 24", time: "9:00 PM", venue: "Estadio BBVA", city: "Monterrey" },

  // GROUP B
  { matchNum: 3, group: "B", home: "Canada", away: "__UEFA_A__", date: "Jun 12", time: "3:00 PM", venue: "BMO Field", city: "Toronto" },
  { matchNum: 5, group: "B", home: "Qatar", away: "Switzerland", date: "Jun 13", time: "3:00 PM", venue: "Levi's Stadium", city: "Santa Clara" },
  { matchNum: 17, group: "B", home: "Canada", away: "Qatar", date: "Jun 18", time: "6:00 PM", venue: "BC Place", city: "Vancouver" },
  { matchNum: 18, group: "B", home: "Switzerland", away: "__UEFA_A__", date: "Jun 18", time: "3:00 PM", venue: "SoFi Stadium", city: "Los Angeles" },
  { matchNum: 39, group: "B", home: "Canada", away: "Switzerland", date: "Jun 24", time: "3:00 PM", venue: "BC Place", city: "Vancouver" },
  { matchNum: 40, group: "B", home: "Qatar", away: "__UEFA_A__", date: "Jun 24", time: "3:00 PM", venue: "Lumen Field", city: "Seattle" },

  // GROUP C
  { matchNum: 6, group: "C", home: "Brazil", away: "Morocco", date: "Jun 13", time: "6:00 PM", venue: "MetLife Stadium", city: "New York/NJ" },
  { matchNum: 7, group: "C", home: "Haiti", away: "Scotland", date: "Jun 13", time: "9:00 PM", venue: "Gillette Stadium", city: "Boston" },
  { matchNum: 19, group: "C", home: "Scotland", away: "Morocco", date: "Jun 19", time: "6:00 PM", venue: "Gillette Stadium", city: "Boston" },
  { matchNum: 20, group: "C", home: "Brazil", away: "Haiti", date: "Jun 19", time: "9:00 PM", venue: "Lincoln Financial Field", city: "Philadelphia" },
  { matchNum: 41, group: "C", home: "Scotland", away: "Brazil", date: "Jun 24", time: "6:00 PM", venue: "Hard Rock Stadium", city: "Miami" },
  { matchNum: 42, group: "C", home: "Morocco", away: "Haiti", date: "Jun 24", time: "6:00 PM", venue: "Mercedes-Benz Stadium", city: "Atlanta" },

  // GROUP D
  { matchNum: 4, group: "D", home: "United States", away: "Paraguay", date: "Jun 12", time: "9:00 PM", venue: "SoFi Stadium", city: "Los Angeles" },
  { matchNum: 8, group: "D", home: "Australia", away: "__UEFA_C__", date: "Jun 13", time: "12:00 PM", venue: "BC Place", city: "Vancouver" },
  { matchNum: 21, group: "D", home: "United States", away: "Australia", date: "Jun 19", time: "3:00 PM", venue: "Lumen Field", city: "Seattle" },
  { matchNum: 22, group: "D", home: "__UEFA_C__", away: "Paraguay", date: "Jun 19", time: "9:00 PM", venue: "Arrowhead Stadium", city: "Kansas City" },
  { matchNum: 43, group: "D", home: "United States", away: "__UEFA_C__", date: "Jun 25", time: "10:00 PM", venue: "SoFi Stadium", city: "Los Angeles" },
  { matchNum: 44, group: "D", home: "Paraguay", away: "Australia", date: "Jun 25", time: "9:00 PM", venue: "Levi's Stadium", city: "Santa Clara" },

  // GROUP E
  { matchNum: 9, group: "E", home: "Germany", away: "Curacao", date: "Jun 14", time: "1:00 PM", venue: "NRG Stadium", city: "Houston" },
  { matchNum: 10, group: "E", home: "Cote d'Ivoire", away: "Ecuador", date: "Jun 14", time: "7:00 PM", venue: "Lincoln Financial Field", city: "Philadelphia" },
  { matchNum: 23, group: "E", home: "Germany", away: "Cote d'Ivoire", date: "Jun 20", time: "4:00 PM", venue: "BMO Field", city: "Toronto" },
  { matchNum: 24, group: "E", home: "Ecuador", away: "Curacao", date: "Jun 20", time: "8:00 PM", venue: "Arrowhead Stadium", city: "Kansas City" },
  { matchNum: 45, group: "E", home: "Curacao", away: "Cote d'Ivoire", date: "Jun 25", time: "4:00 PM", venue: "Lincoln Financial Field", city: "Philadelphia" },
  { matchNum: 46, group: "E", home: "Ecuador", away: "Germany", date: "Jun 25", time: "4:00 PM", venue: "MetLife Stadium", city: "New York/NJ" },

  // GROUP F
  { matchNum: 11, group: "F", home: "Netherlands", away: "Japan", date: "Jun 14", time: "4:00 PM", venue: "AT&T Stadium", city: "Dallas" },
  { matchNum: 12, group: "F", home: "__UEFA_B__", away: "Tunisia", date: "Jun 14", time: "10:00 PM", venue: "Estadio BBVA", city: "Monterrey" },
  { matchNum: 25, group: "F", home: "Netherlands", away: "__UEFA_B__", date: "Jun 20", time: "1:00 PM", venue: "NRG Stadium", city: "Houston" },
  { matchNum: 26, group: "F", home: "Tunisia", away: "Japan", date: "Jun 20", time: "10:00 PM", venue: "Estadio BBVA", city: "Monterrey" },
  { matchNum: 47, group: "F", home: "Japan", away: "__UEFA_B__", date: "Jun 25", time: "7:00 PM", venue: "AT&T Stadium", city: "Dallas" },
  { matchNum: 48, group: "F", home: "Tunisia", away: "Netherlands", date: "Jun 25", time: "7:00 PM", venue: "Arrowhead Stadium", city: "Kansas City" },

  // GROUP G
  { matchNum: 13, group: "G", home: "Belgium", away: "Egypt", date: "Jun 15", time: "3:00 PM", venue: "Lumen Field", city: "Seattle" },
  { matchNum: 14, group: "G", home: "Iran", away: "New Zealand", date: "Jun 15", time: "9:00 PM", venue: "SoFi Stadium", city: "Los Angeles" },
  { matchNum: 27, group: "G", home: "Belgium", away: "Iran", date: "Jun 21", time: "3:00 PM", venue: "SoFi Stadium", city: "Los Angeles" },
  { matchNum: 28, group: "G", home: "New Zealand", away: "Egypt", date: "Jun 21", time: "9:00 PM", venue: "BC Place", city: "Vancouver" },
  { matchNum: 49, group: "G", home: "Egypt", away: "Iran", date: "Jun 26", time: "11:00 PM", venue: "Lumen Field", city: "Seattle" },
  { matchNum: 50, group: "G", home: "New Zealand", away: "Belgium", date: "Jun 26", time: "11:00 PM", venue: "BC Place", city: "Vancouver" },

  // GROUP H
  { matchNum: 51, group: "H", home: "Spain", away: "Cabo Verde", date: "Jun 15", time: "12:00 PM", venue: "Mercedes-Benz Stadium", city: "Atlanta" },
  { matchNum: 52, group: "H", home: "Saudi Arabia", away: "Uruguay", date: "Jun 15", time: "6:00 PM", venue: "Hard Rock Stadium", city: "Miami" },
  { matchNum: 29, group: "H", home: "Spain", away: "Saudi Arabia", date: "Jun 21", time: "12:00 PM", venue: "Mercedes-Benz Stadium", city: "Atlanta" },
  { matchNum: 30, group: "H", home: "Uruguay", away: "Cabo Verde", date: "Jun 21", time: "6:00 PM", venue: "Hard Rock Stadium", city: "Miami" },
  { matchNum: 53, group: "H", home: "Cabo Verde", away: "Saudi Arabia", date: "Jun 26", time: "8:00 PM", venue: "NRG Stadium", city: "Houston" },
  { matchNum: 54, group: "H", home: "Spain", away: "Uruguay", date: "Jun 26", time: "8:00 PM", venue: "Estadio Akron", city: "Guadalajara" },

  // GROUP I
  { matchNum: 55, group: "I", home: "France", away: "Senegal", date: "Jun 16", time: "3:00 PM", venue: "MetLife Stadium", city: "New York/NJ" },
  { matchNum: 56, group: "I", home: "__FIFA_2__", away: "Norway", date: "Jun 16", time: "6:00 PM", venue: "Gillette Stadium", city: "Boston" },
  { matchNum: 31, group: "I", home: "France", away: "__FIFA_2__", date: "Jun 22", time: "5:00 PM", venue: "Lincoln Financial Field", city: "Philadelphia" },
  { matchNum: 32, group: "I", home: "Norway", away: "Senegal", date: "Jun 22", time: "8:00 PM", venue: "MetLife Stadium", city: "New York/NJ" },
  { matchNum: 57, group: "I", home: "Norway", away: "France", date: "Jun 26", time: "3:00 PM", venue: "Gillette Stadium", city: "Boston" },
  { matchNum: 58, group: "I", home: "Senegal", away: "__FIFA_2__", date: "Jun 26", time: "3:00 PM", venue: "BMO Field", city: "Toronto" },

  // GROUP J
  { matchNum: 59, group: "J", home: "Argentina", away: "Algeria", date: "Jun 16", time: "9:00 PM", venue: "Arrowhead Stadium", city: "Kansas City" },
  { matchNum: 60, group: "J", home: "Austria", away: "Jordan", date: "Jun 17", time: "12:00 AM", venue: "Levi's Stadium", city: "Santa Clara" },
  { matchNum: 33, group: "J", home: "Argentina", away: "Austria", date: "Jun 22", time: "1:00 PM", venue: "AT&T Stadium", city: "Dallas" },
  { matchNum: 34, group: "J", home: "Jordan", away: "Algeria", date: "Jun 22", time: "11:00 PM", venue: "Levi's Stadium", city: "Santa Clara" },
  { matchNum: 61, group: "J", home: "Jordan", away: "Argentina", date: "Jun 27", time: "10:00 PM", venue: "AT&T Stadium", city: "Dallas" },
  { matchNum: 62, group: "J", home: "Algeria", away: "Austria", date: "Jun 27", time: "10:00 PM", venue: "Arrowhead Stadium", city: "Kansas City" },

  // GROUP K
  { matchNum: 63, group: "K", home: "Portugal", away: "__FIFA_1__", date: "Jun 17", time: "1:00 PM", venue: "NRG Stadium", city: "Houston" },
  { matchNum: 64, group: "K", home: "Uzbekistan", away: "Colombia", date: "Jun 17", time: "10:00 PM", venue: "Estadio Azteca", city: "Mexico City" },
  { matchNum: 35, group: "K", home: "Portugal", away: "Uzbekistan", date: "Jun 23", time: "1:00 PM", venue: "NRG Stadium", city: "Houston" },
  { matchNum: 36, group: "K", home: "Colombia", away: "__FIFA_1__", date: "Jun 23", time: "10:00 PM", venue: "Estadio Akron", city: "Guadalajara" },
  { matchNum: 65, group: "K", home: "Colombia", away: "Portugal", date: "Jun 27", time: "7:30 PM", venue: "Hard Rock Stadium", city: "Miami" },
  { matchNum: 66, group: "K", home: "__FIFA_1__", away: "Uzbekistan", date: "Jun 27", time: "7:30 PM", venue: "Mercedes-Benz Stadium", city: "Atlanta" },

  // GROUP L
  { matchNum: 67, group: "L", home: "England", away: "Croatia", date: "Jun 17", time: "4:00 PM", venue: "AT&T Stadium", city: "Dallas" },
  { matchNum: 68, group: "L", home: "Ghana", away: "Panama", date: "Jun 17", time: "7:00 PM", venue: "BMO Field", city: "Toronto" },
  { matchNum: 69, group: "L", home: "England", away: "Ghana", date: "Jun 23", time: "4:00 PM", venue: "Gillette Stadium", city: "Boston" },
  { matchNum: 70, group: "L", home: "Panama", away: "Croatia", date: "Jun 23", time: "7:00 PM", venue: "BMO Field", city: "Toronto" },
  { matchNum: 71, group: "L", home: "England", away: "Panama", date: "Jun 27", time: "5:00 PM", venue: "MetLife Stadium", city: "New York/NJ" },
  { matchNum: 72, group: "L", home: "Croatia", away: "Ghana", date: "Jun 27", time: "5:00 PM", venue: "Lincoln Financial Field", city: "Philadelphia" },
];
