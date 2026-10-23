import test from "node:test";
import assert from "node:assert/strict";
import { activationUrl, buildFeedbackMail, buildInvitationMail, buildResetMail, linearTicketUrl } from "./mailer";

/**
 * Ce qui peut casser en silence dans un courriel, c'est le LIEN : un jeton mal
 * encode, une origine avec une barre en trop, un `&` avale par le HTML. La
 * personne recoit alors un message parfaitement mis en forme qui ne marche pas,
 * et le diagnostic prend une demi-journee.
 *
 * Le reste — la formulation, la mise en page — ne se teste pas utilement.
 */

test("le lien d'activation encode le jeton", () => {
  const url = activationUrl("https://studio.exemple.fr", "a+b/c=d&e");
  assert.equal(url, "https://studio.exemple.fr/activation?jeton=a%2Bb%2Fc%3Dd%26e");
});

test("le lien tolere une origine terminee par des barres", () => {
  assert.equal(
    activationUrl("https://studio.exemple.fr///", "jeton"),
    "https://studio.exemple.fr/activation?jeton=jeton"
  );
});

test("l'invitation porte le lien en texte brut ET en HTML", () => {
  const mail = buildInvitationMail({
    to: "jean@exemple.fr",
    name: "Jean",
    roleLabel: "Editeur",
    origin: "https://studio.exemple.fr",
    token: "JETON",
    invitedBy: "Marie",
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  });

  const attendu = "https://studio.exemple.fr/activation?jeton=JETON";
  assert.ok(mail.text.includes(attendu), "lien absent de la version texte");
  assert.ok(mail.html.includes(attendu), "lien absent de la version HTML");
  assert.ok(mail.text.includes("Editeur"));
  assert.ok(mail.text.includes("Marie"));
  assert.equal(mail.to, "jean@exemple.fr");
});

test("le nom de l'invitant est echappe dans le HTML", () => {
  // Le nom vient d'un champ libre de /admin/comptes : il ne doit pas pouvoir
  // injecter de balise dans le message envoye a un tiers.
  const mail = buildInvitationMail({
    to: "jean@exemple.fr",
    name: "<script>alert(1)</script>",
    roleLabel: "Editeur",
    origin: "https://studio.exemple.fr",
    token: "JETON",
    invitedBy: "Marie",
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  });

  assert.ok(!mail.html.includes("<script>"), "balise non echappee dans le HTML");
  assert.ok(mail.html.includes("&lt;script&gt;"));
});

test("la reinitialisation annonce une duree en heures, jamais zero", () => {
  const mail = buildResetMail({
    to: "jean@exemple.fr",
    name: "Jean",
    origin: "https://studio.exemple.fr",
    token: "JETON",
    // Une echeance deja passee ne doit pas produire « valable 0 heure(s) ».
    expiresAt: new Date(Date.now() - 1000),
  });

  assert.ok(mail.text.includes("valable 1 heure(s)"));
});

test("les textes envoyes sont accentues", () => {
  /*
   * La convention ASCII de ce depot porte sur le CODE. Le corps d'un courriel
   * est du contenu lu par une personne, comme la documentation — et
   * « Votre acces au Studio, avec le role Editeur » est parti pendant quelques
   * jours avant que quelqu'un ne le remarque.
   *
   * Ce test fige le sens de la convention, pas une liste de mots.
   */
  const invitation = buildInvitationMail({
    to: "jean@exemple.fr",
    name: "Jean",
    roleLabel: "Éditeur",
    origin: "https://studio.exemple.fr",
    token: "JETON",
    invitedBy: "Marie",
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  });

  assert.match(invitation.subject, /accès/);
  assert.match(invitation.text, /accès/);
  assert.match(invitation.text, /rôle/);
  assert.ok(!/\bacces\b/.test(invitation.text), "« acces » sans accent dans le texte envoye");
  assert.ok(!/\brole\b/.test(invitation.text), "« role » sans accent dans le texte envoye");

  const reinit = buildResetMail({
    to: "jean@exemple.fr",
    name: "Jean",
    origin: "https://studio.exemple.fr",
    token: "JETON",
    expiresAt: new Date(Date.now() + 2 * 3_600_000),
  });

  assert.match(reinit.subject, /Réinitialiser/);
  assert.match(reinit.text, /réinitialisation/i);
  assert.match(reinit.text, /n'êtes pas à l'origine/);
});

test("le lien Linear encode le titre et la description, et n'impose aucune equipe", () => {
  const url = linearTicketUrl({ title: "Un titre", description: "Une ligne\nune autre" });
  assert.equal(
    url,
    "https://linear.new?title=Un+titre&description=Une+ligne%0Aune+autre"
  );
  // Deviner une equipe produirait soit un ticket au mauvais endroit, soit un
  // lien casse : voir le commentaire de linearTicketUrl dans mailer.ts.
  assert.ok(!url.includes("team="), "une equipe Linear a ete devinee");
});

test("le retour porte le message ET le lien de creation de ticket Linear", () => {
  const mail = buildFeedbackMail({
    to: "super@exemple.fr",
    authorName: "Camille",
    authorEmail: "camille@exemple.fr",
    message: "Le bouton d'export ne répond pas sur Firefox.",
  });

  assert.equal(mail.to, "super@exemple.fr");
  assert.ok(mail.text.includes("Camille"));
  assert.ok(mail.text.includes("Le bouton d'export ne répond pas sur Firefox."));
  assert.ok(mail.text.includes("https://linear.new?"), "lien Linear absent du texte");
  assert.ok(mail.html.includes("https://linear.new?"), "lien Linear absent du HTML");
});

test("le message d'un retour est echappe dans le HTML", () => {
  // Comme le nom d'un invitant : un champ libre ne doit pas pouvoir injecter de
  // balise dans le courriel recu par le super-administrateur.
  const mail = buildFeedbackMail({
    to: "super@exemple.fr",
    authorName: "<b>Camille</b>",
    authorEmail: "camille@exemple.fr",
    message: "<script>alert(1)</script>",
  });

  assert.ok(!mail.html.includes("<script>"), "balise non echappee dans le HTML");
  assert.ok(!mail.html.includes("<b>Camille</b>"), "nom non echappe dans le HTML");
});
