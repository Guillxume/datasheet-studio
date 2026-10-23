import test from "node:test";
import assert from "node:assert/strict";
import { inspectUrl, isBlockedAddress } from "./publicUrl";

/**
 * Un filtre anti-SSRF ne se teste pas « en gros ». Chaque plage qu'il oublie est
 * une porte, et les oublis classiques sont toujours les memes : la notation
 * IPv6 encapsulee, le CGNAT, le lien-local des metadonnees cloud, et le
 * decimal-entier. Ils sont tous ici.
 *
 * Ces tests ne touchent PAS au reseau : `isBlockedAddress` et `inspectUrl` sont
 * purs. La resolution DNS (`isPublicUrl`) et les redirections (`safeFetch`)
 * demanderaient un serveur, donc une infrastructure — ce que `pnpm test` s'interdit.
 */

test("les plages non routables sont bloquees", () => {
  const bloquees = [
    "127.0.0.1", "127.1.2.3",           // boucle locale
    "0.0.0.0", "0.1.2.3",               // « cet hote »
    "10.0.0.1", "10.255.255.254",       // prive
    "172.16.0.1", "172.31.255.254",     // prive
    "192.168.0.1", "192.168.255.254",   // prive
    "169.254.169.254",                  // metadonnees cloud — LA cible classique
    "100.64.0.1", "100.127.255.254",    // CGNAT
    "198.18.0.1",                       // essais de debit
    "224.0.0.1", "239.255.255.255",     // multicast
    "255.255.255.255",                  // diffusion
  ];

  for (const adresse of bloquees) {
    assert.equal(isBlockedAddress(adresse), true, `${adresse} devrait etre bloquee`);
  }
});

test("les adresses publiques passent", () => {
  for (const adresse of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1", "100.63.255.255", "100.128.0.1"]) {
    assert.equal(isBlockedAddress(adresse), false, `${adresse} devrait passer`);
  }
});

test("les bornes des plages privees sont exactes", () => {
  // 172.16/12 s'arrete a 172.31 : ce sont les deux erreurs classiques.
  assert.equal(isBlockedAddress("172.15.255.255"), false);
  assert.equal(isBlockedAddress("172.16.0.0"), true);
  assert.equal(isBlockedAddress("172.31.255.255"), true);
  assert.equal(isBlockedAddress("172.32.0.0"), false);
});

test("l'IPv6 non routable est bloquee", () => {
  for (const adresse of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1"]) {
    assert.equal(isBlockedAddress(adresse), true, `${adresse} devrait etre bloquee`);
  }
});

test("l'IPv6 publique passe", () => {
  for (const adresse of ["2606:4700:4700::1111", "2a00:1450:4007::68"]) {
    assert.equal(isBlockedAddress(adresse), false, `${adresse} devrait passer`);
  }
});

test("une IPv4 encapsulee en IPv6 est jugee comme de l'IPv4", () => {
  // Le contournement le plus simple : reecrire 127.0.0.1 en ::ffff:127.0.0.1.
  assert.equal(isBlockedAddress("::ffff:127.0.0.1"), true);
  assert.equal(isBlockedAddress("::ffff:169.254.169.254"), true);
  assert.equal(isBlockedAddress("::ffff:8.8.8.8"), false);
});

test("l'ecriture HEXADECIMALE d'une IPv4 encapsulee est jugee pareil", () => {
  /*
   * Ce test a trouve un vrai defaut dans la premiere version de ce module.
   * `new URL("http://[::ffff:10.0.0.1]/")` rend `hostname` = "[::ffff:a00:1]" :
   * l'URL NORMALISE l'adresse, et une comparaison sur la notation pointee
   * laissait donc passer exactement le contournement qu'elle fermait.
   *
   *   ::ffff:a00:1   = 10.0.0.1
   *   ::ffff:7f00:1  = 127.0.0.1
   *   ::ffff:a9fe:a9fe = 169.254.169.254
   */
  assert.equal(isBlockedAddress("::ffff:a00:1"), true);
  assert.equal(isBlockedAddress("::ffff:7f00:1"), true);
  assert.equal(isBlockedAddress("::ffff:a9fe:a9fe"), true);
  assert.equal(isBlockedAddress("::ffff:808:808"), false); // 8.8.8.8
});

test("une IPv6 mal formee est refusee plutot qu'interpretee", () => {
  for (const valeur of ["::ffff::1", "1:2:3", "fe80:::1", "gggg::1"]) {
    assert.equal(isBlockedAddress(valeur), true, valeur);
  }
});

test("l'identifiant de zone ne masque pas une adresse lien-local", () => {
  assert.equal(isBlockedAddress("fe80::1%eth0"), true);
});

test("ce qui n'est pas une adresse est refuse", () => {
  for (const valeur of ["", "pas-une-adresse", "999.1.1.1", "1.2.3", "0x7f000001", "2130706433"]) {
    assert.equal(isBlockedAddress(valeur), true, `${valeur} devrait etre refuse`);
  }
});

test("seuls http et https sont acceptes", () => {
  for (const url of ["file:///etc/passwd", "gopher://x/", "ftp://exemple.fr/i.png", "data:image/png;base64,AAA"]) {
    const verdict = inspectUrl(url);
    assert.equal(verdict.ok, false, url);
  }
  assert.equal(inspectUrl("https://exemple.fr/logo.png").ok, true);
});

test("une adresse litterale privee est refusee sans DNS", () => {
  assert.equal(inspectUrl("http://169.254.169.254/latest/meta-data/").ok, false);
  assert.equal(inspectUrl("http://127.0.0.1:3000/").ok, false);
  assert.equal(inspectUrl("http://[::1]:3000/").ok, false);
  assert.equal(inspectUrl("http://[::ffff:10.0.0.1]/").ok, false);
});

test("localhost et les domaines internes sont refuses par le nom", () => {
  // Ils ne resolvent pas forcement sur 127.0.0.1 selon la configuration : le
  // controle par le nom double celui par l'adresse.
  for (const url of ["http://localhost:3000/", "http://db.localhost/", "http://app.internal/x.png"]) {
    assert.equal(inspectUrl(url).ok, false, url);
  }
});

test("des identifiants dans l'URL sont refuses", () => {
  // http://exemple.fr@169.254.169.254/ se lit de travers a l'oeil nu.
  assert.equal(inspectUrl("http://utilisateur:secret@exemple.fr/i.png").ok, false);
});

test("le motif de refus est explicite", () => {
  const verdict = inspectUrl("http://10.0.0.5/logo.png");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.raison, /non publique/);
});
