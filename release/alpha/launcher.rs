//! Read-only loopback launcher for the extracted alpha. No third-party crates.
use std::{env, fs, io::{self, Read, Write}, net::{TcpListener, TcpStream}, path::{Path, PathBuf}, time::Duration};

fn decode_path(target: &str) -> Option<PathBuf> {
    let target = target.split('?').next()?;
    if !target.starts_with('/') { return None; }
    let mut bytes = Vec::new();
    let mut chars = target.bytes();
    while let Some(c) = chars.next() {
        bytes.push(if c == b'%' {
            let a = (chars.next()? as char).to_digit(16)?;
            let b = (chars.next()? as char).to_digit(16)?;
            (a * 16 + b) as u8
        } else { c });
    }
    let text = String::from_utf8(bytes).ok()?;
    if text.chars().any(|c| c.is_control() || c == '\\' || c == ':') { return None; }
    let mut path = PathBuf::new();
    for part in text.split('/').filter(|p| !p.is_empty()) {
        if part == "." || part == ".." || part.ends_with(['.', ' ']) { return None; }
        path.push(part);
    }
    if path.as_os_str().is_empty() { path.push("Examples/Jade-Sentinel/demo.html"); }
    Some(path)
}

fn reply(stream: &mut TcpStream, status: &str, mime: &str, bytes: &[u8], head: bool) -> io::Result<()> {
    write!(stream, "HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nCross-Origin-Resource-Policy: same-origin\r\nContent-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\r\n\r\n", bytes.len())?;
    if !head { stream.write_all(bytes)?; }
    Ok(())
}

fn serve(stream: &mut TcpStream, root: &Path, host: &str) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
    stream.set_write_timeout(Some(Duration::from_secs(5)))?;
    let mut request = Vec::new();
    let mut chunk = [0; 1024];
    loop {
        let n = stream.read(&mut chunk)?;
        if n == 0 { return Ok(()); }
        request.extend_from_slice(&chunk[..n]);
        if request.len() > 8192 { return reply(stream, "431 Request Header Fields Too Large", "text/plain", b"Request too large", false); }
        if request.windows(4).any(|w| w == b"\r\n\r\n") { break; }
    }
    let Ok(request) = std::str::from_utf8(&request) else { return reply(stream, "400 Bad Request", "text/plain", b"Invalid request", false); };
    let mut lines = request.split("\r\n");
    let mut start = lines.next().unwrap_or("").split_whitespace();
    let method = start.next().unwrap_or("");
    let target = start.next().unwrap_or("");
    let head = method == "HEAD";
    let hosts: Vec<_> = lines.filter_map(|line| line.split_once(':')).filter(|(name, _)| name.eq_ignore_ascii_case("host")).collect();
    if hosts.len() != 1 || hosts[0].1.trim() != host { return reply(stream, "403 Forbidden", "text/plain", b"Only the printed loopback address is allowed", head); }
    if method != "GET" && !head { return reply(stream, "405 Method Not Allowed", "text/plain", b"Read-only server: GET or HEAD only", false); }
    let Some(relative) = decode_path(target) else { return reply(stream, "400 Bad Request", "text/plain", b"Invalid local path", head); };
    let Ok(path) = root.join(relative).canonicalize() else { return reply(stream, "404 Not Found", "text/plain", b"File not found in the extracted candidate", head); };
    if !path.starts_with(root) || !path.is_file() { return reply(stream, "403 Forbidden", "text/plain", b"Path is outside the candidate or is not a file", head); }
    let mime = match path.extension().and_then(|s| s.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8", "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json", "png" => "image/png", "css" => "text/css",
        "md" | "txt" => "text/plain; charset=utf-8", _ => "application/octet-stream",
    };
    match fs::read(path) {
        Ok(bytes) => reply(stream, "200 OK", mime, &bytes, head),
        Err(_) => reply(stream, "500 Internal Server Error", "text/plain", b"Cannot read file; check access permissions", head),
    }
}

fn main() -> io::Result<()> {
    let root = env::current_exe()?.parent().ok_or_else(|| io::Error::other("No launcher directory"))?.canonicalize()?;
    if !root.join("distribution-manifest.json").is_file() { return Err(io::Error::other("Extract the complete candidate before starting the demo")); }
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let host = listener.local_addr()?.to_string();
    let url = format!("http://{host}/Examples/Jade-Sentinel/demo.html");
    println!("Ankhimate local demo\n{url}\nRead-only, loopback only. Keep this window open. Press Ctrl+C to stop.");
    io::stdout().flush()?;
    if !env::args().any(|a| a == "--no-browser") {
        if let Err(error) = std::process::Command::new("explorer.exe").arg(&url).spawn() { eprintln!("Open the printed address in your browser: {error}"); }
    }
    for stream in listener.incoming() {
        match stream { Ok(mut stream) => { let _ = serve(&mut stream, &root, &host); }, Err(error) => eprintln!("Connection failed: {error}") }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_are_relative_and_windows_safe() {
        for p in ["/../x", "/%2e%2e/x", "/%5cserver/x", "/C:/x", "/file:stream", "/a%00b", "/a.", "/a%20", "/%ff", "//x/../a"] { assert!(decode_path(p).is_none(), "{p}"); }
        assert_eq!(decode_path("/Exports/Jade%20%C3%A9/skeleton.json?v=1").unwrap(), PathBuf::from("Exports/Jade é/skeleton.json"));
        assert_eq!(decode_path("/").unwrap(), PathBuf::from("Examples/Jade-Sentinel/demo.html"));
    }
}
