export const slugify = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const resolveSkuGroup = (d) => {
  const g = String(d?.sku_group || "").trim().toLowerCase();
  if (g === "membership" || g === "currency") return g;
  const hay = `${d?.vendor_sku || d?.sku || ""} ${d?.code || ""} ${d?.label || d?.name || ""} ${d?.badge || ""}`;
  if (
    /\b(membership|member|welkin|blessing|inter-knot|interknot|wdp|weekly\s*diamond\s*pass|twilight\s*pass|starlight|supply\s*pass|express\s*supply|lunite\s*subscription|royale\s*pass|booyah\s*pass|elite\s*pass|battle\s*pass|season\s*pass|star\s*pass|premium\s*pass|monthly\s*card|weekly\s*card|monthly\s*pass|weekly\s*pass|half-monthly|pyroxene\s*pack|roaring\s*month|knight\s*pass|paladin\s*pass|privilege\s*pass|b-chips\s*monthly|vip\s*card|kartu\s*bulanan|kartu\s*mingguan|berkah|langganan|subscription|pass|paket\s*mingguan|paket\s*bulanan|level\s*up\s*pass)\b/i.test(
      hay
    )
  ) {
    return "membership";
  }
  return "currency";
};

export const resolveBuiltInDigiflazzFields = (gameOrMeta, allGames = []) => {
  const slug = slugify(gameOrMeta?.slug || gameOrMeta?.name || "");
  const prefix = String(gameOrMeta?.vendor_prefix || "").trim().toUpperCase();

  const matchedExisting = (allGames || []).find(
    (g) =>
      String(g.slug || "").toLowerCase() === slug ||
      (prefix && String(g.vendor_prefix || "").toUpperCase() === prefix)
  );
  if (matchedExisting && Array.isArray(matchedExisting.fields) && matchedExisting.fields.length > 0) {
    return matchedExisting.fields;
  }

  if (
    slug.includes("mobile-legends") ||
    slug.includes("magic-chess") ||
    prefix === "ML" ||
    prefix === "MCGG"
  ) {
    return [
      { key: "user_id", label: "User ID", placeholder: "123456789", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 15, pattern: "^[0-9]{5,15}$", help: "Masukkan angka User ID sesuai profil game Anda" },
      { key: "zone_id", label: "Zone ID", placeholder: "1234", type: "text", inputmode: "numeric", required: true, min_len: 3, max_len: 6, pattern: "^[0-9]{3,6}$", help: "Masukkan angka Zone ID (di dalam tanda kurung)" },
    ];
  }

  if (
    slug.includes("genshin") ||
    slug.includes("zenless") ||
    slug.includes("honkai-star-rail") ||
    prefix === "GI" ||
    prefix === "ZZZ" ||
    prefix === "HSR"
  ) {
    return [
      { key: "user_id", label: "UID", placeholder: "800123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "Masukkan UID angka akun HoYoverse Anda" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, options: ["Asia", "America", "Europe", "TW, HK, MO"], help: "Pilih server akun HoYoverse Anda" },
    ];
  }

  if (slug.includes("wuthering") || prefix === "WW") {
    return [
      { key: "user_id", label: "UID", placeholder: "900123456", type: "text", inputmode: "numeric", required: true, min_len: 8, max_len: 12, pattern: "^[0-9]{8,12}$", help: "Masukkan 9 digit UID Wuthering Waves" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, options: ["SEA", "Asia", "America", "Europe", "HMT (HK, MO, TW)"], help: "Pilih server Wuthering Waves Anda" },
    ];
  }

  if (
    slug.includes("ragnarok") ||
    slug.includes("dragon-nest") ||
    prefix === "ROM" ||
    prefix === "ROO" ||
    prefix === "DN2" ||
    prefix === "DN2E"
  ) {
    return [
      { key: "user_id", label: "Role ID / Character ID", placeholder: "4300123456", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 18, pattern: "^[0-9]{5,18}$", help: "Masukkan angka Role ID / Character ID karakter Anda" },
      { key: "server", label: "Server", placeholder: "Nama Server", type: "text", inputmode: "text", required: true, min_len: 2, max_len: 30, help: "Masukkan nama atau kode Server karakter Anda" },
    ];
  }

  if (slug.includes("blue-archive") || prefix === "BA" || prefix === "BLUEARCHIVE") {
    return [
      { key: "user_id", label: "Account ID (UID)", placeholder: "10234567", type: "text", inputmode: "numeric", required: true, min_len: 5, max_len: 16, pattern: "^[0-9]{5,16}$", help: "Masukkan angka UID di menu Akun Blue Archive Anda" },
      { key: "server", label: "Server", placeholder: "Pilih Server", type: "select", inputmode: "text", required: true, min_len: 2, max_len: 20, options: ["Asia", "Global", "NA", "KR", "TW/HK/MO"], help: "Pilih server akun Blue Archive Anda" },
    ];
  }

  if (slug.includes("reverse-1999") || prefix === "R1999" || prefix === "REV1999") {
    return [
      { key: "user_id", label: "Account ID (UID)", placeholder: "401234567", type: "text", inputmode: "numeric", required: true, min_len: 6, max_len: 15, pattern: "^[0-9]{6,15}$", help: "Masukkan angka UID di halaman profil Reverse: 1999 Anda" },
    ];
  }

  if (slug.includes("honkai-impact") || prefix === "HI3" || prefix === "HONKAI3") {
    return [
      { key: "user_id", label: "User ID (UID)", placeholder: "10012345", type: "text", inputmode: "numeric", required: true, min_len: 7, max_len: 12, pattern: "^[0-9]{7,12}$", help: "Masukkan 7–10 digit UID Honkai Impact 3rd Anda" },
    ];
  }

  if (slug.includes("valorant") || slug.includes("wild-rift") || prefix === "VAL" || prefix === "WR") {
    return [
      { key: "riot_id", label: "Riot ID#Tag", placeholder: "Player#IDN", type: "text", inputmode: "text", required: true, min_len: 4, max_len: 32, help: "Format wajib: Nickname#Tag (Contoh: Player#IDN)" },
    ];
  }

  if (Array.isArray(gameOrMeta?.fields) && gameOrMeta.fields.length > 0) {
    return gameOrMeta.fields;
  }

  return [
    { key: "user_id", label: "User ID / Player ID", placeholder: "Masukkan ID Akun Game", type: "text", inputmode: "numeric", required: true, min_len: 4, max_len: 24, help: "Masukkan User ID / Player ID sesuai profil di dalam game" },
  ];
};

export const resolveCustomerNoFormatLabel = (fields = []) => {
  const keys = fields.map((f) => f.key);
  if (keys.includes("user_id") && keys.includes("zone_id")) {
    return "{user_id}{zone_id} (Digabung otomatis ke Digiflazz)";
  }
  if (keys.includes("riot_id")) {
    return "{riot_id} (Nickname#Tag)";
  }
  if (keys.includes("user_id") && keys.includes("server")) {
    return "{user_id} + {server}";
  }
  return "{user_id}";
};

export const translateFieldMeta = (field, lang) => {
  if (!field || lang !== "en") {
    return {
      label: field?.label || "",
      placeholder: field?.placeholder || `Masukkan ${field?.label || "ID"}...`,
      help: field?.help || "",
    };
  }
  const rawLabel = String(field.label || "").trim();
  const labelMap = {
    "User ID": "User ID",
    "User ID (UID)": "User ID (UID)",
    "Account ID (UID)": "Account ID (UID)",
    "Account ID (PID)": "Account ID (PID)",
    "Role ID / Character ID": "Role ID / Character ID",
    "Role ID / Secret Code": "Role ID / Secret Code",
    "Zone ID": "Zone ID",
    "Server": "Server",
    "Server / Region": "Server / Region",
    "Region Server": "Server Region",
    "UID": "UID",
    "Player ID": "Player ID",
    "Player UID": "Player UID",
    "Player ID / OpenID": "Player ID / OpenID",
    "OpenID / Player ID": "OpenID / Player ID",
    "Player Tag": "Player Tag",
    "IGG ID": "IGG ID",
    "Hunter ID": "Hunter ID",
    "Space ID": "Space ID",
    "Username In-Game": "In-Game Username",
    "Username Roblox / No. WhatsApp": "Roblox Username / WhatsApp No.",
    "No. WhatsApp / Steam ID": "WhatsApp No. / Steam ID",
    "Riot ID": "Riot ID",
    "Riot ID#Tag": "Riot ID#Tag",
    "Tagline": "Tagline",
    "Open ID": "Open ID",
    "Character ID": "Character ID",
    "Role ID": "Role ID",
    "ID Tujuan": "Target ID",
    "Nomor Tujuan": "Target Number",
  };
  const label = labelMap[rawLabel] || rawLabel;

  let placeholder = String(field.placeholder || "").trim();
  if (!placeholder) {
    placeholder =
      Array.isArray(field.options) && field.options.length > 0
        ? `Select ${label}...`
        : `Enter ${label}...`;
  } else {
    placeholder = placeholder
      .replace(/^Pilih\s+/i, "Select ")
      .replace(/^Masukkan\s+/i, "Enter ")
      .replace(/^Contoh:\s*/i, "Example: ")
      .replace(/\batau\b/gi, "or")
      .replace(/\bdigit\b/gi, "digits");
  }

  let help = String(field.help || "").trim();
  if (help) {
    help = help
      .replace(/Lihat di profil in-game/gi, "Check your in-game profile")
      .replace(/Lihat di profil/gi, "Check your profile")
      .replace(/Pilih server sesuai akun game Anda\.?/gi, "Select the server matching your game account.")
      .replace(/Pilih server tempat karakter Anda berada\.?/gi, "Select the server where your character is located.")
      .replace(/Masukkan angka di dalam tanda kurung sebelah User ID\.?/gi, "Enter the digits inside parentheses next to your User ID.")
      .replace(/Masukkan User ID akun game Anda\.?/gi, "Enter your in-game User ID.")
      .replace(/Masukkan UID yang tertera di pojok kanan bawah layar\.?/gi, "Enter the UID shown at the bottom-right corner of your screen.")
      .replace(/Format:\s*/gi, "Format: ")
      .replace(/Wajib diisi/gi, "Required");
  }

  return { label, placeholder, help };
};
