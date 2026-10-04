-- 083_unterlagen_aemter.sql  ·  v1833
--
-- DIE AEMTER-ERNTE
--
-- Marcel am 04.10.2026: "wenn wir irgendwelche Unterlagen fuer ein Objekt
-- brauchen, dass wir die halt anfragen koennen ... und dass da halt auch
-- immer vernuenftige Sachen bei rauskommen."
--
-- Fuer jede der fuenf Unterlagen (Flurkarte, Grundbuch, Altlasten,
-- Baulasten, Bauakte) ist ein anderes Amt zustaendig, und die
-- Zustaendigkeit haengt an der Gemeinde: mal die Stadt, mal der Kreis, mal
-- ein Landesamt. Das herauszufinden kostet eine KI-Recherche mit
-- Websuche.
--
--   > Eine Recherche, die bei jedem Objekt von vorn beginnt, ist keine
--   > Recherche, sondern eine Gebuehr.
--
-- Dieselbe Logik wie beim Gutachterausschuss-Register: einmal ermitteln,
-- belegen, hinterlegen - und beim naechsten Objekt in derselben Gemeinde
-- steht es da. Deshalb haengt der Satz an (gemeinde_schluessel, art) und
-- nicht am Objekt.
--
-- WAS HIER MITGEFUEHRT WIRD, UND WARUM:
--
--   quelle_url    die offizielle Seite, auf der die Adresse WOERTLICH
--                 steht. Ohne sie ist die Adresse eine Behauptung.
--   beleg_ok      ob wir die Seite selbst abgerufen und die Adresse dort
--                 gefunden haben. Die KI sagt, wo sie es gelesen hat; wir
--                 sehen nach.
--   geprueft_am   wann zuletzt nachgesehen wurde. Aemter ziehen um,
--                 Postfaecher werden abgeschaltet.
--
-- Das ist dieselbe Doktrin wie bei den amtlichen Kennzahlen: jede Angabe
-- traegt ihre Herkunft, und wo kein Beleg ist, steht das da statt einer
-- stillen Zahl.

CREATE TABLE IF NOT EXISTS unterlagen_aemter (
  id                 bigserial PRIMARY KEY,
  gemeinde_schluessel text NOT NULL,          -- "32609-huellhorst"
  plz                text,
  ort                text,
  art                text NOT NULL,           -- flurkarte|grundbuch|altlasten|baulasten|bauakte
  behoerde           text NOT NULL,
  abteilung          text,
  email              text,
  telefon            text,
  kanal              text,                    -- email|portal|formular|post
  antrag_url         text,
  quelle_url         text,
  seiten             jsonb,                   -- weitere gelesene amtliche Seiten
  gebuehr            text,
  hinweis            text,
  kreis              text,
  bundesland         text,
  beleg_ok           boolean NOT NULL DEFAULT false,
  beleg_grund        text,
  geprueft_am        timestamptz,
  erstellt_am        timestamptz NOT NULL DEFAULT now(),
  erstellt_von       uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (gemeinde_schluessel, art)
);

CREATE INDEX IF NOT EXISTS unterlagen_aemter_ort_idx
  ON unterlagen_aemter (plz, art);

COMMENT ON TABLE unterlagen_aemter IS
  'v1833 · Die geerntete Zustaendigkeit je Gemeinde und Unterlagenart. '
  'Einmal ermittelt, belegt und hinterlegt - beim naechsten Objekt in '
  'derselben Gemeinde steht es da.';

COMMENT ON COLUMN unterlagen_aemter.beleg_ok IS
  'v1833 · Wir haben die Quellseite SELBST abgerufen und die Adresse dort '
  'gefunden. false heisst: die KI nennt eine Quelle, wir konnten sie nicht '
  'bestaetigen - dann wird der Nutzer gewarnt, nicht stillschweigend '
  'bedient.';

-- Die Anfragen selbst: was wurde wann fuer welches Objekt angefordert.
CREATE TABLE IF NOT EXISTS unterlagen_anfragen (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  objekt_id     uuid REFERENCES objects(id) ON DELETE CASCADE,
  art           text NOT NULL,
  amt_id        bigint REFERENCES unterlagen_aemter(id) ON DELETE SET NULL,
  betreff       text,
  anschreiben   text,
  status        text NOT NULL DEFAULT 'entwurf',  -- entwurf|gesendet|erledigt|abgebrochen
  gesendet_am   timestamptz,
  erstellt_am   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unterlagen_anfragen_objekt_idx
  ON unterlagen_anfragen (objekt_id, art);

COMMENT ON TABLE unterlagen_anfragen IS
  'v1833 · Je Objekt und Unterlage ein Vorgang. `status` bleibt auf '
  'entwurf, bis der Nutzer ausdruecklich sendet - DealPilot verschickt '
  'nichts von selbst.';
