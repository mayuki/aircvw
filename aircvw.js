//
// Aircvw Core
//
// $Id$
//
/*@cc_on 
var doc = document;
eval('var document = doc');
@*/

var Aircvw = {
    //
    // private
    //
    _logData       : null,
    _logDataLines  : null,
    _logParsedData : null,
    _version       : "$Id: view.html 16 2006-03-02 15:02:14Z mayuki $",

    //
    // public
    //
    matchedIdCache      : new Array(),
    matchedElementCache : new Array(),
    parseTime     : 0,
    renderingTime : 0,
    highlightTimerId    : -1,
    highlightLineNumber : -1,
    searchMaxLineCount  : 1000,
    
    /**
     * ログのテキストデータ
     */
    setLogData        : function(text) {
        this._logData = text;
        this._logDataLines = null;
        this._logParsedData = null;
    },
    
    /**
     * 行に分割されたテキストデータ
     */
    getLogDataLines  : function(){
        if (this._logDataLines == null) {
            this._logDataLines = this._logData.split(this.compiledRegexs.newline);
        }
        return this._logDataLines;
    },
    
    /**
     * 解析されたログデータ
     */
    getLogParsedData : function() {
        if (this._logParsedData == null) {
            this._logParsedData = new Array();
            var startTime = new Date();
            var lines = Aircvw.getLogDataLines();
            for (var i = 0, n = lines.length; i < n; i++) {
                var msg = parseLine(lines[i]);
                if (msg) { this._logParsedData.push(msg); }
            }
             this.parseTime = (new Date()) - startTime;
             this._logParsedData = this._logParsedData.reverse();
        }
        return this._logParsedData;
    },
    
    
    /**
     * 正規表現
     */
    compiledRegexs : {
            newline:
                new RegExp(/(\n|\r\n)/),
            url:
                new RegExp(/h?ttps?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:@&=+$,%#]+/g),
            mynick:
                new RegExp(/^My nick is changed \((.+) -> (.+)\)$/),
            nick:
                new RegExp(/^(.+) -> (.+)$/),
            join:
                new RegExp(/^\+ (.+) \(([^!]+)!([^@]+)@([^)]+)\) to/),
            part:
                new RegExp(/^- (.+) from/),
            quit:
                new RegExp(/^! (.+) \((.*)\)$/),
            mode:
                new RegExp(/^Mode by (.+): #([^ ]+) (.+)$/),
            privmsg:
                new RegExp(/^<?[^>]+:([^>]*?)> (.+)$/),
            privmsgself:
                new RegExp(/^>?[^<]+:([^<]*?)< (.+)$/),
            notice:
                new RegExp(/^\(?[^>]+:([^>]*?)\) (.+)$/),
            noticeself:
                new RegExp(/^\)?[^<]+:([^<]*?)\( (.+)$/),
            time:
                new RegExp(/^(\d+:\d+:\d+) (.+)$/)
    }
};

function parseLine(line) {
    if (line == null || line.length < 6) return null;
    var matches = line.match(Aircvw.compiledRegexs.time);
    if (!matches) { return null; }
    var time = matches[1];
    var body = matches[2];
    
    // privmsg
    if (Aircvw.compiledRegexs.privmsg.test(body)) {
        return ["PRIVMSG", time, "<"+RegExp.$1+"> "+RegExp.$2];
    }
    // privmsg(self)
    if (Aircvw.compiledRegexs.privmsgself.test(body)) {
        return ["PRIVMSG", time, ">"+RegExp.$1+"< "+RegExp.$2, true];
    }
    
    // mynick -> mynewnick
    // [a-zA-Z0-9\[\]^{}]
    if (Aircvw.compiledRegexs.mynick.test(body)) {
        return ["NICK", time, "Nick "+RegExp.$1+" → "+RegExp.$2];
    }

    // nick -> newnick
    // [a-zA-Z0-9\[\]^{}]
    if (Aircvw.compiledRegexs.nick.test(body)) {
        return ["NICK", time, "Nick "+RegExp.$1+" → "+RegExp.$2];
    }

    // join
    if (Aircvw.compiledRegexs.join.test(body)) {
        return ["JOIN", time, "* "+RegExp.$1+" Join ("+RegExp.$3+"@"+RegExp.$4+")"];
    }

    // part
    if (Aircvw.compiledRegexs.part.test(body)) {
        return ["PART", time, "* "+RegExp.$1+" Part ("+RegExp.$3+"@"+RegExp.$4+")"];
    }

    // quit
    if (Aircvw.compiledRegexs.quit.test(body)) {
        return ["QUIT", time, "* "+RegExp.$1+" Quit ("+RegExp.$2+")"];
    }

    // mode
    if (Aircvw.compiledRegexs.mode.test(body)) {
        return ["MODE", time, "* "+RegExp.$1+" Mode "+RegExp.$3];
    }
    
    // notice
    if (Aircvw.compiledRegexs.notice.test(body)) {
        return ["NOTICE", time, "("+RegExp.$1+") "+RegExp.$2];
    }
    // notice(self)
    if (Aircvw.compiledRegexs.noticeself.test(body)) {
        return ["NOTICE", time, ")"+RegExp.$1+"( "+RegExp.$2, true];
    }

    
    return ["UNKNOWN", time, body];
}

function renderLogData() {
    var startTime = new Date();
    rerenderLogData();
    Aircvw.renderingTime = (new Date()) - startTime;
}

function rerenderLogData() {
    var result = document.getElementById("result");
    var resultHTML = "";
    var lineCount = 0;
    var ignoreTypes = new Array();
    var elements = Form.getElements("ControlPanelForm");

    //result.style.display = 'none';
    result.innerHTML = ''; // 子ノードを消す(手抜き)

    for (var i = 0; i < elements.length; i++) {
        if (elements[i].name.match(/^ignore([A-Z].*)$/) && elements[i].checked) {
            ignoreTypes.push(RegExp.$1);
        }
    }

    var ignoreTypesHash = new Array();
    for (var typeIndex = 0; typeIndex < ignoreTypes.length; typeIndex++) {
        ignoreTypesHash[ignoreTypes[typeIndex].toUpperCase()] = true;
    }

    var lines = Aircvw.getLogParsedData();
    for (var i = 0; i < lines.length; i++) {
        var msg = lines[i];

        var body = msg[2];
        var ignore = false;

        if (ignoreTypesHash[msg[0]]) {
            ignore = true;
        }

        if (!ignore) {
            lineCount++;
            var li = document.createElement('li');
            li.appendChild(document.createTextNode(msg[1]+' | '+body));
            li.innerHTML = li.innerHTML.replace(Aircvw.compiledRegexs.url, '<a href="$&">$&</a>');
            li.className = 'msg-'+msg[0];
            li.id = 'm'+DateCurrent.toIDString() + "-" + i;
            result.appendChild(li);
        }
    }
    result.style.display = 'block';
}

function startSearch() {
    var keyword = Form.getInputs("ControlPanelForm", "text", "keyword")[0];
    
    //alert(window.event.keyCode);
    // 上下キーで次のマッチへの処理
    if (window.event) {
        if (window.event.keyCode == 40 /* DOWN */) {
            // ハイライトは即実行
            highlightDelay();
            scrollNextMatchLine();
            return;
        } else if (window.event.keyCode == 38 /* UP */) {
            // ハイライトは即実行
            highlightDelay();
            scrollNextMatchLine(true); // rev
            return;
        }
    }

    // 前と同じなら何もしない
    if (keyword.prevvalue == keyword.value) { return; }
    keyword.prevvalue = keyword.value;
    // ハイライトを無効に
    window.clearTimeout(Aircvw.highlightTimerId);
    // 検索
    renderLogSearchResult();
}

function renderLogSearchResult() {
    var searchresult = document.getElementById("searchResult");
    var keyword = Form.getInputs("ControlPanelForm", "text", "keyword")[0];
    var chkUseRegex = Form.getInputs("ControlPanelForm", "checkbox", "useRegex")[0];
    var chkCaseInsensitive = Form.getInputs("ControlPanelForm", "checkbox", "caseInsensitive")[0];

    if (keyword.value.length <= 0) {
        clearSearchResult(); return;
    }
    
    var searchMaxLineCount = Aircvw.searchMaxLineCount;
    var hitCount = 0;
    var reKeyword;
    var useRegex = chkUseRegex.checked;
    var caseInsensitive = chkCaseInsensitive.checked;

    // use RegExp
    if (useRegex) {
        try {
            reKeyword = new RegExp(keyword.value, caseInsensitive ? 'i' : '');
            reKeyword.compile(keyword.value, caseInsensitive ? 'i' : '');
        } catch (e) { return; }
    }

    clearSearchResult();
    
    var searchResultDisplayOrig = searchresult.style.display;
    searchresult.style.display = 'none';
    searchresult.innerHTML = '';

    //
    // search
    //
    var lines = Aircvw.getLogParsedData();
    Aircvw.matchedElementCache = new Array();
    for (var i = 0; i < lines.length; i++) {
        var msg = lines[i];
        var body = msg[2];
        if (msg[0] != 'PRIVMSG' && msg[0] != 'NOTICE') {
            continue;
        }
        
        // keyword search
        // 見つからなかったら次の行へスキップ
        if (useRegex) {
            // regexp
            if (!reKeyword.test(body)) { continue; }
        } else {
            // indexof
            if (caseInsensitive) {
                if (body.toLowerCase().indexOf(keyword.value.toLowerCase()) == -1) { continue; }
            } else {
                if (body.indexOf(keyword.value) == -1) { continue; }
            }
        }
        
        Aircvw.matchedIdCache.push(i);

        hitCount++;
        var li = document.createElement('li');
        //li.innerHTML = '<a href="#m'+i+'">'+(msg[1]+' | '+body).escapeHTML()+'</a>';
        li.innerHTML = '<a href="javascript:scrollLine('+i+');">'+(msg[1]+' | '+body).escapeHTML()+'</a>';
        li.className = 'msg-'+msg[0];
        searchresult.appendChild(li);
        
        // 最大数
        if (hitCount > searchMaxLineCount) {
            clearSearchResult(); 
            searchresult.innerHTML = "<li>キーワードを含む発言は"+searchMaxLineCount+"個以上見つかりました。最大表示数を超えているため表示されません</li>";
            searchresult.style.display = 'block';
            return;
        }
    }
    Aircvw.highlightTimerId = window.setTimeout(highlightDelay, 1000);

    searchresult.style.display = searchResultDisplayOrig;
}

function highlightDelay() {
    window.clearTimeout(Aircvw.highlightTimerId);
    for (var i = 0; i < Aircvw.matchedIdCache.length; i++) {
        var me = document.getElementById("m"+DateCurrent.toIDString()+"-"+Aircvw.matchedIdCache[i]);
        if (me) {
            Aircvw.matchedElementCache.push(me);
            if (!me.className.match(/(matched | matched)$/)) {
                me.className = 'matched '+me.className;
            }
        }
    }
}

function clearSearchResult() {
    var searchresult = document.getElementById("searchResult");
    searchresult.innerHTML = '';
    var keyword = Form.getInputs("ControlPanelForm", "text", "keyword")[0];
    

    for (var i = 0; i < Aircvw.matchedElementCache.length; i++) {
        Aircvw.matchedElementCache[i].className = Aircvw.matchedElementCache[i].className.replace(/(matched | matched)/, '');
    }
    
    Aircvw.matchedIdCache = new Array();
    Aircvw.matchedElementCache = new Array();
    Aircvw.highlightLineNumber = -1;
}


var DateCurrent = new Date();
function prev() {
    DateCurrent.setDate(DateCurrent.getDate()-1);
    loadLog();
    startSearch();
}
function next() {
    DateCurrent.setDate(DateCurrent.getDate()+1);
    loadLog();
    startSearch();
}

function initialize() {
    //var keyword = Form.getInputs("ControlPanelForm", "text", "keyword")[0];
    var keyword = document.getElementById("keyword");
    var result = document.getElementById("result");
    result.innerHTML = "";
    clearSearchResult();
    keyword.prevvalue = '';
    Aircvw.setLogData('');
}

function loadLog() {
    var head = document.getElementById("head");
    var result = document.getElementById("result");
    var aReq;
    var url;
    var filename = "";

    initialize();

    // URLのセット
    window.location.hash = "m"+DateCurrent.toIDString();
    var prevDate = new Date(); prevDate.setTime(DateCurrent.getTime()); prevDate.setDate(prevDate.getDate() - 1);
    var nextDate = new Date(); nextDate.setTime(DateCurrent.getTime()); nextDate.setDate(nextDate.getDate() + 1);

    document.getElementById('prev').href = "#m"+ (prevDate.toIDString());
    document.getElementById('next').href = "#m"+ (nextDate.toIDString());

    result.innerHTML = "<li>データを取得しています...</li>";

    filename = DateCurrent.toIDString() + '.txt';
    url = filename;
    if (url.match("([^/]+)$")) {
        document.title = "aircvw: "+RegExp.$1;
        head.innerHTML = ("aircvw: "+RegExp.$1).escapeHTML();
    }

    aReq = new Ajax.Request(url,
        {
            asynchronous : true,
            onSuccess    : function (response) {
                Aircvw.setLogData(response.responseText);
                //alert(aReq.transport.responseText);

                result.innerHTML = "<li>データを解析しています...</li>";

                renderLogData();

                try { 
                    window.status = "Parse Time: "+Aircvw.parseTime+"ms, Render Time: "+Aircvw.renderingTime+"ms.";
                } catch (e) {}
            },
            onFailure     : function (response) {
                result.innerHTML = "<li>ログデータの取得に失敗しました (Status: ["+response.status.toString().escapeHTML()+"] "+response.statusText.toString().escapeHTML()+")</li>";
                result.innerHTML += "<li>URL: "+url.escapeHTML()+"</li>";
                return;
            }
        }
    );
}

function setUseInclemental() {
    var eUseInc = document.getElementById("useInclemental");
    var eKeyword = document.getElementById("keyword");
    if (eUseInc.checked) {
        eKeyword.onkeyup = startSearch;
    } else {
        eKeyword.onkeyup = null;
    }
}

function optionExpand() {
    var e = document.getElementById("ControlPanelForm");
    var e2 = document.getElementById("searchResult");
    var controlpane = document.getElementById("ControlerContainer");
    var content = document.getElementById("content");
    if (e.style.display != 'block') {
        e2.style.display = e.style.display = 'block';
        content.style.top = controlpane.clientHeight;
    } else {
        e2.style.display = e.style.display = 'none';
        content.style.top = "2em";
    }
}

function main() {
    //alert(window.location.search);
    var matches;
    if (matches = window.location.hash.match(/m(\d\d\d\d)\.(\d\d)\.(\d\d)/)) {
        DateCurrent = new Date(parseInt(matches[1]), parseInt(matches[2].replace(/^0/,''))-1, parseInt(matches[3].replace(/^0/,'')));
    }
    loadLog();
}

function scrollNextMatchLine(directionReverse) {
    if (Aircvw.matchedIdCache.length < 1) { return; }

    // 未選択
    if (Aircvw.highlightLineNumber == -1) {
        if (directionReverse) {
        // 上方向
            scrollLine(Aircvw.matchedIdCache[Aircvw.matchedIdCache.length-1]);
            return;
        } else {
            // 下方向
            scrollLine(Aircvw.matchedIdCache[0]);
        }
        return;
    }
    
    for (var i = 0; i < Aircvw.matchedIdCache.length; i++) {
        // 内容はソート済みなのでこれで。
        if (Aircvw.highlightLineNumber == Aircvw.matchedIdCache[i]) {
            if (directionReverse) {
            // 上方向
                // 前のIDがあればそこへジャンプ
                if (i > 0) {
                    scrollLine(Aircvw.matchedIdCache[i-1]);
                    return;
                } else {
                    // 最後にいっとく
                    scrollLine(Aircvw.matchedIdCache[Aircvw.matchedIdCache.length-1]);
                    return;
                }
            } else {
            // 下方向
                // 次のIDがあればそこへジャンプ
                if (i != Aircvw.matchedIdCache.length - 1) {
                    scrollLine(Aircvw.matchedIdCache[i+1]);
                    return;
                } else {
                    // はじめに戻っとく
                    scrollLine(Aircvw.matchedIdCache[0]);
                    return;
                }
            }
        }
    }
}

function scrollLine(lineNum) {
    window.location.hash = "m"+DateCurrent.toIDString()+"-"+lineNum;
    document.getElementById('keyword').focus();

    var e = document.getElementById("m"+DateCurrent.toIDString()+"-"+lineNum);
    var container = document.getElementById("ControlerContainer");
    var origLeft = document.body.scrollLeft;
    //alert(Position.realOffset(e)[1]);
    //alert(document.body.scrollTop+"/"+(Position.cumulativeOffset(e)));
    document.body.scrollLeft = origLeft;

    if (Position.cumulativeOffset(e)[1]+document.body.clientHeight != document.body.scrollHeight) {
        document.body.scrollTop = Position.cumulativeOffset(e)[1] - container.scrollHeight;
    } else {
        e.scrollIntoView();
    }
    
    Aircvw.highlightLineNumber = lineNum;
}

Date.prototype.toIDString = function () {
    var id = '';
    id = this.getFullYear();
    id += '.' + (this.getMonth() > 8 ? this.getMonth()+1 : '0' + (this.getMonth()+1));
    id += '.' + (this.getDate() > 9 ? this.getDate() : '0' + this.getDate());

    return id;
};

String.prototype._compiledEntityRegex = new RegExp(/[&<>"]/g);
String.prototype.escapeHTML = function() {
        return this.replace(this._compiledEntityRegex, function(c) {
            if (c == '&') return '&amp;';
            if (c == '<') return '&lt;';
            if (c == '>') return '&gt;';
            if (c == '"') return '&quot;';
        });
        //return this.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;');
    };
// vim:set expandtab ts=4 sw=4 sts=4 :   
