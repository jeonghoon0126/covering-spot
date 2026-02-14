export interface LadderPrice {
  type: string; // "10층 이상" | "10층 미만"
  prices: { duration: string; price: number }[];
}

export const LADDER_PRICES: LadderPrice[] = [
  {
    type: "10층 이상",
    prices: [
      { duration: "1시간 미만(기본요금)", price: 140000 },
      { duration: "1시간", price: 230000 },
      { duration: "2시간", price: 320000 },
      { duration: "3시간", price: 410000 },
      { duration: "4시간", price: 500000 },
      { duration: "5시간", price: 590000 },
      { duration: "6시간", price: 680000 },
      { duration: "7시간", price: 770000 },
    ],
  },
  {
    type: "10층 미만",
    prices: [
      { duration: "1시간 미만(기본요금)", price: 130000 },
      { duration: "1시간", price: 210000 },
      { duration: "2시간", price: 290000 },
      { duration: "3시간", price: 370000 },
      { duration: "4시간", price: 450000 },
      { duration: "5시간", price: 530000 },
      { duration: "6시간", price: 610000 },
      { duration: "7시간", price: 690000 },
    ],
  },
];
