#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ==================================
// WIFI
// ==================================
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// ==================================
// THINGSPEAK
// Preencha os dados do seu canal.
// O canal pode ser publico (READ_API_KEY vazio).
// ==================================
const char* CHANNEL_ID = "SEU_CHANNEL_ID";
const char* READ_API_KEY = ""; // Necessario se o canal for privado
const char* WRITE_API_KEY = "SUA_WRITE_API_KEY";

const char* THINGSPEAK_UPDATE_URL = "https://api.thingspeak.com/update";

// ==================================
// SENSOR DS18B20
// ==================================
#define DS18B20_PIN 4
OneWire oneWire(DS18B20_PIN);
DallasTemperature sensor(&oneWire);

// ==================================
// LCD I2C
// ==================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ==================================
// KEYPAD 4X4
// ==================================
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

byte rowPins[ROWS] = {13, 14, 16, 17};
byte colPins[COLS] = {18, 19, 23, 25};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// ==================================
// CONFIGURACOES
// ==================================
Preferences preferences;

float temperatura = 0.0;
float limite = -18.0;
int statusFreezer = 1;

bool configurando = false;
String entradaLimite = "";

unsigned long ultimaLeitura = 0;
unsigned long ultimoEnvio = 0;
unsigned long ultimaConsultaRemota = 0;

const unsigned long INTERVALO_LEITURA = 2000;
const unsigned long INTERVALO_ENVIO = 20000;
const unsigned long INTERVALO_CONSULTA_REMOTA = 20000;

// Quando true, a proxima publicacao tambem atualiza o Field 4.
// Usado ao salvar no keypad ou aplicar uma solicitacao remota.
bool publicarLimite = false;

// ==================================
// STATUS
// ==================================
int identificarStatus(float temp) {
  if (temp <= limite) return 1;
  if (temp <= limite + 2.0) return 2;
  return 3;
}

// ==================================
// WIFI
// ==================================
void conectarWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
  Serial.print("Conectando ao Wi-Fi");

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi conectado!");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi indisponivel.");
  }
}

// ==================================
// LCD
// ==================================
void atualizarLCD() {
  if (configurando) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Novo limite:");
    lcd.setCursor(0, 1);
    lcd.print(entradaLimite);
    return;
  }

  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(temperatura, 1);
  lcd.print(" C   ");

  lcd.setCursor(0, 1);
  lcd.print("Lim:");
  lcd.print(limite, 1);
  lcd.print(" ");

  if (statusFreezer == 1) lcd.print("NORMAL ");
  else if (statusFreezer == 2) lcd.print("ATENCAO");
  else lcd.print("CRITICO");
}

// ==================================
// PUBLICAR ALTERACAO LOCAL/REMOTA
// ==================================
void marcarLimiteParaPublicacao() {
  publicarLimite = true;
  statusFreezer = identificarStatus(temperatura);
  atualizarLCD();
}

// ==================================
// CONFIGURAR LIMITE PELO KEYPAD
// ==================================
void processarTeclado() {
  char tecla = keypad.getKey();
  if (!tecla) return;

  if (tecla == 'A') {
    configurando = true;
    entradaLimite = "";
    atualizarLCD();
    return;
  }

  if (!configurando) return;

  if (tecla >= '0' && tecla <= '9') {
    if (entradaLimite.length() < 7) entradaLimite += tecla;
  }
  else if (tecla == '*') {
    if (entradaLimite.length() > 0 && entradaLimite.indexOf('.') == -1) {
      entradaLimite += ".";
    }
  }
  else if (tecla == 'B') {
    if (entradaLimite.startsWith("-")) entradaLimite.remove(0, 1);
    else entradaLimite = "-" + entradaLimite;
  }
  else if (tecla == 'C') {
    if (entradaLimite.length() > 0) {
      entradaLimite.remove(entradaLimite.length() - 1);
    }
  }
  else if (tecla == '#') {
    if (entradaLimite.length() > 0 &&
        entradaLimite != "-" &&
        entradaLimite != "." &&
        entradaLimite != "-.") {
      float novoLimite = entradaLimite.toFloat();

      if (novoLimite >= -40.0 && novoLimite <= 15.0) {
        limite = novoLimite;
        preferences.putFloat("limite", limite);
        marcarLimiteParaPublicacao();

        Serial.print("Novo limite pelo keypad: ");
        Serial.println(limite);

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Limite salvo!");
        lcd.setCursor(0, 1);
        lcd.print("Sincronizando...");
        delay(900);
      } else {
        lcd.clear();
        lcd.print("Valor invalido");
        delay(900);
      }
    }

    configurando = false;
    entradaLimite = "";
  }
  else if (tecla == 'D') {
    configurando = false;
    entradaLimite = "";
  }

  atualizarLCD();
}

// ==================================
// CONSULTAR FIELD 4 (LIMITE REMOTO)
// Procura o ultimo valor publicado no Field 4.
// Os registros periodicos do ESP32 nao apagam o Field 4,
// pois a publicacao normal envia somente Fields 1, 2 e 3.
// ==================================
void consultarLimiteRemoto() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (String(CHANNEL_ID) == "SEU_CHANNEL_ID") return;

  HTTPClient http;
  String url = "https://api.thingspeak.com/channels/";
  url += CHANNEL_ID;
  url += "/fields/4.json?results=1";

  if (strlen(READ_API_KEY) > 0) {
    url += "&api_key=";
    url += READ_API_KEY;
  }

  http.begin(url);
  int resposta = http.GET();

  if (resposta == HTTP_CODE_OK) {
    String corpo = http.getString();
    DynamicJsonDocument doc(2048);
    DeserializationError erro = deserializeJson(doc, corpo);

    if (!erro) {
      JsonArray feeds = doc["feeds"].as<JsonArray>();
      if (feeds.size() > 0 && !feeds[0]["field4"].isNull()) {
        float limiteRemoto = feeds[0]["field4"].as<float>();

        if (limiteRemoto >= -40.0 && limiteRemoto <= 15.0 &&
            fabs(limiteRemoto - limite) >= 0.05) {
          Serial.print("Novo limite recebido online: ");
          Serial.println(limiteRemoto);

          limite = limiteRemoto;
          preferences.putFloat("limite", limite);
          marcarLimiteParaPublicacao(); // confirma no Field 2 e Field 4

          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("Limite atualizado");
          lcd.setCursor(0, 1);
          lcd.print("Pelo dashboard");
          delay(900);
        }
      }
    } else {
      Serial.print("Erro ao ler JSON remoto: ");
      Serial.println(erro.c_str());
    }
  } else {
    Serial.print("Erro consulta remota: ");
    Serial.println(resposta);
  }

  http.end();
}

// ==================================
// LEITURA DO SENSOR
// ==================================
void lerTemperatura() {
  sensor.requestTemperatures();
  float leitura = sensor.getTempCByIndex(0);

  if (leitura == DEVICE_DISCONNECTED_C) {
    Serial.println("Erro no sensor DS18B20");
    return;
  }

  temperatura = leitura;
  statusFreezer = identificarStatus(temperatura);

  Serial.print("Temperatura: ");
  Serial.print(temperatura);
  Serial.println(" C");

  atualizarLCD();
}

// ==================================
// ENVIAR AO THINGSPEAK
// Publicacao normal: Fields 1, 2 e 3.
// Ao sincronizar limite: inclui tambem Field 4.
// ==================================
void enviarThingSpeak() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sem conexao Wi-Fi.");
    return;
  }
  if (String(WRITE_API_KEY) == "SUA_WRITE_API_KEY") {
    Serial.println("Configure a WRITE_API_KEY.");
    return;
  }

  HTTPClient http;
  String url = String(THINGSPEAK_UPDATE_URL);
  url += "?api_key=";
  url += WRITE_API_KEY;
  url += "&field1=" + String(temperatura, 2);
  url += "&field2=" + String(limite, 2);
  url += "&field3=" + String(statusFreezer);

  if (publicarLimite) {
    url += "&field4=" + String(limite, 2);
  }

  http.begin(url);
  int resposta = http.GET();

  if (resposta > 0) {
    String retorno = http.getString();
    long entryId = retorno.toInt();

    Serial.print("ThingSpeak entry: ");
    Serial.println(retorno);

    if (entryId > 0) {
      if (publicarLimite) {
        publicarLimite = false;
        Serial.println("Limite sincronizado no ThingSpeak.");
      }
    } else {
      Serial.println("Registro nao aceito. Verifique chave e intervalo de 15s.");
    }
  } else {
    Serial.print("Erro HTTP: ");
    Serial.println(resposta);
  }

  http.end();
}

// ==================================
// SETUP
// ==================================
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Freezer IoT");
  lcd.setCursor(0, 1);
  lcd.print("Iniciando...");

  sensor.begin();
  preferences.begin("freezer", false);
  limite = preferences.getFloat("limite", -18.0);

  conectarWiFi();
  lcd.clear();
  lerTemperatura();

  // Sincroniza o limite salvo no equipamento no primeiro envio.
  publicarLimite = true;
}

// ==================================
// LOOP
// ==================================
void loop() {
  processarTeclado();

  unsigned long agora = millis();

  if (agora - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = agora;
    lerTemperatura();
  }

  if (agora - ultimaConsultaRemota >= INTERVALO_CONSULTA_REMOTA) {
    ultimaConsultaRemota = agora;
    consultarLimiteRemoto();
  }

  if (agora - ultimoEnvio >= INTERVALO_ENVIO) {
    ultimoEnvio = agora;
    enviarThingSpeak();
  }

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }
}
