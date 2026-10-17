export const mapProviders = [
  {
    label: "Apple Maps",
    buildHref: (location: string) =>
      `https://maps.apple.com/?address=${encodeURIComponent(location)}`,
    icon: "/icons/apple-maps.png",
  },
  {
    label: "Google Maps",
    buildHref: (location: string) =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
    icon: "/icons/google-maps.png",
  },
  {
    label: "Waze",
    buildHref: (location: string) =>
      `https://waze.com/ul?q=${encodeURIComponent(location)}&navigate=yes`,
    icon: "/icons/waze.png",
  },
];
