const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// フォームから送られてきたデータ（URLエンコード形式）を読み取れるようにする
app.use(express.urlencoded({ extended: true }));

// 静的ファイル（HTMLなど）を公開
app.use(express.static(path.join(__dirname, 'public')));

// フォームからのデータを受け取るエンドポイント
app.post('/submit', (req, res) => {
    const username = req.body.name;
    const newPassword = req.body['new-password'];

    if (!username) {
        return res.status(400).send('名前が入力されていません。');
    }

    // カンマやダブルクォーテーションのエスケープ処理
    const safeUser = username.replace(/"/g, '""');
    const safePassword = newPassword.replace(/"/g, '""');
    const csvRow = `"${safeUser}","${safePassword}","${new Date().toISOString()}"\n`;

    // サーバー上の CSV ファイルに追記
    const filePath = path.join(__dirname, 'DataBase.csv');

    fs.appendFile(filePath, csvRow, (err) => {
        if (err) {
            console.error('書き込みエラー:', err);
            return res.status(500).send('サーバーエラーが発生しました。');
        }

        // ★書き込みが成功したら、別のページ（thanks.html）へ強制的に移動（リダイレクト）させる
        res.redirect('/home.html');
    });
});

app.listen(PORT, () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});