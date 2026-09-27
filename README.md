# Anime TTS Gateway

スマートフォンだけでも利用・保守できる、個人用TTS Gatewayです。

## MVP
- 日本語テキスト入力
- 発話スタイル指定
- Gemini TTSによる音声生成
- ブラウザ再生
- WAV保存
- APIキーをGitHubへ置かない
- Gatewayへの簡易認証

## 構成
- GitHub: コードの正本
- Cloudflare Workers: Web UI + TTS Gateway
- Gemini API: 音声生成
- ChatGPT / Codex: 設計・実装・レビュー

## 必須Secret
Cloudflare Workers側に以下を設定します。
- `GEMINI_API_KEY`
- `ACCESS_TOKEN`

`ACCESS_TOKEN` はGateway専用の長いランダム文字列です。

## デプロイ
1. この一式をGitHubリポジトリへ置く
2. Cloudflare WorkersからGitHubリポジトリを接続
3. `GEMINI_API_KEY` と `ACCESS_TOKEN` をWorkerのSecretsへ登録
4. デプロイURLをスマホで開く
5. Access Tokenを入力してTTSを試す

## 方針
MVPが安定するまで以下は追加しません。
- Voice Design管理UI
- 複数キャラクター
- MP3/M4A変換
- BGM/SE
- 履歴DB
- MCP
- 複数TTS Provider
