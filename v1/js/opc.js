var op = {//chord printer
    NOTES:"A,A#,Bb,B,C,C#,Cb,D,D#,Eb,E,F,F#,Gb,G,G#,Ab".split(","),
    MODS:",7,9,m,dim,aug,+,m7,m9,7m,9m".split(","),
    BOTTOM_PAD: 60,
    DROP_BOILERPLATE:["©","to cell phone","improve your playing","contact us","by following the link above"],
    LS_PAPER_SIZE:"OnePageChord_PaperSize",
    LS_STORE_CHORDS:"OnePageChord_Chords:",
    _:{},
    init:function() {
        op._.w$ = $(window);
        op._.i$ = $("#Input");
        op._.o$ = $("#Out");
        op._.p$ = $("#Previous");
        op.resize();
        mu.init(op.show);
    },
    show:function(){
        window.onresize = op.resize;
        op.restoreSize();
        op.showPreviousChords();
        op.disableOutput();
        op.parseText();
        op.INPUT_LINE_HEIGHT = Number(op._.i$.css("lineHeight").split("px").shift());
        op.OUT_LINE_HEIGHT   = Number(op._.o$.css("lineHeight").split("px").shift());
    },
    useStorage:function(fnc) {
        if(!localStorage) return;
        try { fnc(); } catch(e) {}
    },        
    clear:function() {
        op._.lines = [];
        op._.linesShown = 0;
        op._.i$.val("");
        op._.o$.html(mu.OutputInitialMessage.th());
    },
    save:function() {
        op.storeChords();
        op.togglePreviousChords(true);
        op.clear();
        setTimeout(function() { op.togglePreviousChords(false); },1000);
    },
    resize:function() {
        var inptop = op._.i$.position().top,
            winhig = op._.w$.height(),
            inphig = ( winhig-inptop-op.BOTTOM_PAD );
        op._.i$.stop().css({height:inphig});
        op._.o$.stop().css({height:inphig}).show();
        op._.panelHeight = inphig;
    },
    disableOutput:function() {
        op._.o$.html(mu.OutputInitialMessage.th());
        $("#Submit,#Size").attr("disabled", "disabled").removeAttr("title");
        $("#SizeWrap").addClass("disabled");
        $("#Out").attr("title","Paste in Chords & Lyrics to the left, and verify the results here on the right.");
    },
    enableOutput:function() {
        $("#Submit,#Size").removeAttr("disabled");
        $("#SizeWrap").removeClass("disabled");
        $("#Out").attr("title","Click on lines to hide/show them in the final PDF");
        $("#Submit").attr("title","If you are happy with the results above, click here to get a PDF");
        $("#Size").attr("title","Change the PDF paper size");
    },
    parseText:function() {
        //todo: this is too big, split up!!
        //basic setup
        var txtall, txtlin, linobj, ntepat, ntergx, spcrgx, rgxmat, rgxhit, spcmat, 
          ledspc, txtlen, lstchr, inprnt, notprn, lin, notlas, notstr, notend, stp, 
          prvbln, orgprvbln, bi, li, mi, ni,
          prncnt, ttllin, shocnt;
          
        txtall = op._.i$.val();
        if(txtall === "") {
            op.disableOutput();
            return; 
        }
        txtall = txtall.split("’").join("'").split("‘").join("'").split("“").join("\"").split("”").join("\"");//replace smart quotes
        txtlin = txtall.split("\n");
        op._.linesTotal = txtlin.length;
        linobj = [];
        
        //note detection & regexes
        ntepat = [];
        for(ni = 0; ni < op.NOTES.length; ni++) { 
            for(mi = 0; mi < op.MODS.length; mi++) {
                ntepat.push(op.NOTES[ni]+op.MODS[mi]);
            }
        }
        ntepat.push("N\\.C\\.","NC");
        ntergx = new RegExp("(^|\\b)+("+ntepat.join("|")+")($|\\b)+","g");
        spcrgx = /\s*/g;

        //first pass line by line processing:
        for(li = 0; li < txtlin.length; li++) {
            rgxmat = txtlin[li].match(ntergx);
            rgxhit = ( rgxmat ? rgxmat.length : 0 );
            txtlin[li] = txtlin[li].replace(/\t/g, '    ').replace(/\s/g, ' ');//sometimes there are other space chars used
            spcmat = txtlin[li].match(spcrgx);
            ledspc = ( spcmat && spcmat.length > 0 ? spcmat[0].length : 0 );
            if(txtlin[li].length == ledspc) { txtlin[li] = ""; }
            txtlen = txtlin[li].length;
            if(txtlen === 0 && linobj.length > 0 && linobj[linobj.length-1].length === 0) continue; //just skip multiple blank lines
            lstchr = txtlin[li].charAt(txtlin[li].length-1);
            inprnt = ( lstchr == "+" );
            notprn = ( lstchr == "-" );
            lin = { 
                noteHits:rgxhit,
                text: ( inprnt || notprn ? txtlin[li].substring(0,txtlin[li].length-1) : txtlin[li] || "" ),
                length:txtlen,
                leadSpaces:ledspc,
                inPrint:inprnt,
                dontPrint:notprn,
                inHeading:false,
                index:li
            };
            lin.textLow = lin.text.toLowerCase();
            linobj.push(lin);
        }

        //attempt to determine start and end of the actual body:
        notlas = -1;//the last notes we passed
        notstr = -1;//where notes start
        notend = linobj.length-1;//where notes end
        for(li = 0; li < linobj.length; li++) {
            if(notstr < 0 && notlas > 0) { //we have no start yet, but current notlas is set
                if(linobj[li].noteHits > 0 && li-notlas < 10) {
                    notstr = notlas;
                }
            }
            if(notstr > -1 && linobj[li].noteHits > 0 && (li == linobj.length-1 || linobj[li+1].length > 0)) { //we have a start, and there are notes
                notend = li+1;
            }
            if(linobj[li].noteHits > 0) {
                notlas = li;
            }
            if(!linobj[li].dontPrint && linobj[li].textLow.indexOf("capo") > -1 && linobj[li].length > "capo".length+1  && linobj[li].textLow.indexOf("following the link") < 0) {
                linobj[li].inPrint = true;
            }
            if(!linobj[li].dontPrint && linobj[li].textLow.indexOf("tuning") > -1 && linobj[li].length > "tuning".length+5 ) {
                linobj[li].inPrint = true;
            }
        }

        //find first line with "by" before proper inPrint and add it as a candidate title line
        for(li = 0; li < notstr; li++) {
            if(!linobj[li].dontPrint && linobj[li].textLow.indexOf(" by ") > 3 && 
              linobj[li].textLow.indexOf(" by ") < linobj[li].text.length-7 && 
              linobj[li].textLow.indexOf("browse by ") < 0 && 
              linobj[li].textLow.indexOf("following the link above") < 0) {
                linobj[li].inPrint = true;
                break;
            }
        }

        //remove extraneous boilerplate lines
        prncnt = 0;
        for(li = Math.max(notstr,0); li <= notend; li++) {
            if(!linobj[li]) continue;
            if(linobj[li].text.indexOf("---") > -1) continue; //chord or tab diagrams
            if(prncnt > 5) {
                stp = false;
                for(bi = 0; bi < op.DROP_BOILERPLATE.length; bi++) {
                    if(linobj[li].textLow.indexOf(op.DROP_BOILERPLATE[bi]) > -1) {
                        linobj[li].inPrint = false;
                        notend = li;
                        stp = true;
                        break;
                    }
                }
                if(stp) break;
            }
            if(!linobj[li].dontPrint) {
                linobj[li].inPrint = true;
                prncnt++;
            }
        }

        //figure out title            
        ttllin = 0;
        for(li = 0; li < linobj.length; li++) {
            if(linobj[li].inPrint) { 
                ttllin = li; 
                break;
            }
        }
        linobj[ttllin].inHeading = true; 
        for(li = 0; li < linobj.length; li++) {
            if(!linobj[li].inPrint) continue;
            
            if(linobj[li].inHeading && !linobj[li].dontPrint) { 
                linobj[li].text = linobj[li].text.replace(/^\s*/,"");
                linobj[li].text = linobj[li].text.split(" chords by ").join(" by ").split(", added :").shift();
                linobj[li].length = linobj[li].text.length;
                linobj.splice(li+1,0,{ 
                    noteHits:0,
                    text:"   ",
                    length:3,
                    leadSpaces:0,
                    inPrint:true,
                    inHeading:true,
                    index:-1
                });       
                break;
            }
        }

        //remove double blank lines
        prvbln = false;
        shocnt = 0;
        for(li = 0; li < linobj.length; li++) {
            if(!linobj[li].inPrint) continue;
            shocnt++;
            if(linobj[li].length === 0 && prvbln) { linobj[li].inPrint = false; continue; }
            prvbln = (linobj[li].length === 0);
        }

        prvbln = false;
        orgprvbln = false;
        for(li = 0; li < linobj.length-1; li++) {
            if(!linobj[li].inPrint) continue;
            if(linobj[li].length > 0) continue; //nonblank lines we ignore
            orgprvbln = prvbln;
            prvbln = true;
            if(linobj[li+1].noteHits > 0) continue; //if the next line is notes, don't remove blank line
            if(linobj[li+1].text.indexOf(":") == linobj[li+1].text.length-1) continue; //don't remove before something like "Chorus:" or "Verse:"
            if(orgprvbln) linobj[li].inPrint = false;
        }

        for(li = 0; li < linobj.length-1; li++) {
            linobj[li].substituteText = ( linobj[li].length === 0 || linobj[li].length == linobj[li].leadSpaces+1 ? mu.SpaceLine.th({}) : linobj[li].text );
        }
            
        if(shocnt > 0) { op.enableOutput(); } else { op.disableOutput(); }
        var output = mu.Lines.th({lines:linobj});
        $("#Out").html(output);
        op._.lines = linobj;
        op._.linesShown = shocnt;
    },
    restoreSize:function() {
        op.useStorage(function() {
            var siz = localStorage.getItem(op.LS_PAPER_SIZE);
            if(siz) { $("#Size").val(siz); }
        });
    },        
    changeSize:function() {
        op.useStorage(function() {
            localStorage.setItem(op.LS_PAPER_SIZE,$("#Size").val());
        });
    },
    toggleInPrint:function(ele) {
        var idx, cls, inprnt, txtall, txtlin, scrtop;
        idx = Number(ele.id.split("_").pop());
        if(idx < 0) return;
        cls = ele.className;
        inprnt = (cls.indexOf("inPrint") > -1);

        txtall = op._.i$.val();
        txtlin = txtall.split("\n");

        if(inprnt) {
            if(txtlin[idx].charAt(txtlin[idx].length-1) == "-" || txtlin[idx].charAt(txtlin[idx].length-1) == "+") {
                txtlin[idx] = txtlin[idx].substring(0,txtlin[idx].length-1);
            }
            txtlin[idx] += "-";
        }
        else {
            if(txtlin[idx].charAt(txtlin[idx].length-1) == "-" || txtlin[idx].charAt(txtlin[idx].length-1) == "+") {
                txtlin[idx] = txtlin[idx].substring(0,txtlin[idx].length-1);
            }
            txtlin[idx] += "+";
        }
            
        scrtop = op._.i$.scrollTop();
        op._.i$.val(txtlin.join("\n")).scrollTop(scrtop);
        op.parseText();
    },  
    MAX_FONT:14,
    LEFT_MARGIN:72, //leaves a nice left margin for hole punches
    RIGHT_MARGIN:54,
    COLUMN_MARGIN:54,    
    TOP_MARGIN:54,
    BOTTOM_MARGIN:54,
    LETTER_PAGE_HEIGHT:792,
    LETTER_PAGE_WIDTH:612,
    A4_PAGE_HEIGHT:842,
    A4_PAGE_WIDTH:595,
    LINE_TO_FONT:1,
    FONT_TIMES_WIDTH: 1.6333,
    prepareAndSubmit:function() {
        var maxlen, outlin, pagsiz, pagwid, paghig, onecoldim, twocoldim, usetwo, linsiz, 
            fntsiz, collin, dis, conhig, ofstwo, outobj, outjso, filnam, li;
        maxlen = 0;
        outlin = [];
        for(li = 0; li < op._.lines.length; li++) {
            if(!op._.lines[li].inPrint) continue;
            outlin.push(op._.lines[li].text.split("\"").join("\\\"").split("“").join("\\\"").split("”").join("\\\""));
            maxlen = Math.max(maxlen,op._.lines[li].text.length);
        }

        if(outlin.length === 0) { return; }
        
        pagsiz = $("#Size").val().toUpperCase();
        pagwid = op[pagsiz+"_PAGE_WIDTH"];
        paghig = op[pagsiz+"_PAGE_HEIGHT"];

        onecoldim = op.getSizes(pagwid-(op.LEFT_MARGIN+op.RIGHT_MARGIN),paghig-(op.TOP_MARGIN+op.BOTTOM_MARGIN),maxlen,outlin);
        twocoldim = op.getSizes((pagwid-(op.LEFT_MARGIN+op.RIGHT_MARGIN+op.COLUMN_MARGIN))/2,2*(paghig-(op.TOP_MARGIN+op.BOTTOM_MARGIN)),maxlen,outlin);
        usetwo = ( twocoldim.fontSize > onecoldim.fontSize );
        linsiz = ( usetwo ? twocoldim : onecoldim ).lineSize;
        fntsiz = ( usetwo ? twocoldim : onecoldim ).fontSize;

        collin = ( usetwo ? Math.floor(outlin.length/2) : outlin.length );
        if(usetwo && collin*linsiz < paghig && outlin[collin-1] !== "" && outlin[collin] !== "") { //try and find a better split point
            dis = 1;
            while(dis < outlin.length/2) { 
                if(collin-dis > 0 && outlin[collin-dis] === "") {
                    collin = collin+1-dis;
                    break;
                }
                else if(collin-dis < outlin.length && outlin[collin+dis] === "") {
                    collin = collin+1+dis;
                    break;
                }
                dis++;
            }
        }

        conhig = Math.ceil(linsiz*outlin.length/( usetwo ? 2 : 1));//content height
        ofstwo = ( !usetwo ? 0 : outlin[collin] === "" ? 0 : 1 ); 
        var title = outlin.shift();
        for(li = 0; li < outlin.length; li++) {
            if(li < collin) {
                outlin[li] = { y: li*linsiz+op.TOP_MARGIN, tx: outlin[li], c: 1 };
            }
            else {
                outlin[li] = { y: (li+ofstwo-collin)*linsiz+op.TOP_MARGIN, tx: outlin[li], c: 2 };
            }
        }
        filnam = op.getHeading().replace(" by ","-").replace(/[^-|^\w|^\d]/g,"")+".pdf";



        var docDefinition = {
            content: [
                {
                    text: title,
                    style: 'header'
                }
            ],
            footer: {
                columns: [{
                    text: 'One Page Chords',
                    alignment: 'right',
                    style: 'footer',
                    margin: [0, 0, 20, 0]
                }]
            },
            styles: {
                header: {
                    fontSize: 15,
                    font: 'LiberationSerif',
                    bold: true
                },
                footer: {
                    fontSize: 10,
                    font: 'LiberationSerif'
                },
                body: {
                    font: 'LiberationMono',
                    fontSize: fntsiz
                }
            },
            //[left, top, right, bottom]
            pageMargins: [70, 50, 30, 30]
        };
        if(!usetwo) {
            docDefinition.content.push({
                style: 'body',
                text: outlin.map(function(lin) { return lin.tx; }).join('\n')
            });
        } else {
            docDefinition.content.push({
                columns: [
                    {
                        width: '49%',
                        style: 'body',
                        text: outlin.filter(function(lin) { return (lin.c === 1); }).map(function(lin) { return lin.tx; }).join('\n')
                    },
                    { width: '2%', text: '' },
                    {
                        width: '49%',
                        style: 'body',
                        text: outlin.filter(function(lin) { return (lin.c === 2); }).map(function(lin) { return lin.tx; }).join('\n')
                    }
                ]
                
            });
        }

        pdfMake.fonts = {
            LiberationSerif: {
                normal: 'LiberationSerif-Regular.ttf',
                bold: 'LiberationSerif-Bold.ttf',
                italics: 'LiberationSerif-Regular.ttf',
                bolditalics: 'LiberationSerif-Bold.ttf'
            },
            LiberationMono: {
                normal: 'LiberationMono-Regular.ttf',
                bold: 'LiberationMono-Regular.ttf',
                italics: 'LiberationMono-Regular.ttf',
                bolditalics: 'LiberationMono-Regular.ttf'
            },
            Roboto: {
                normal: 'Roboto-Regular.ttf',
                bold: 'Roboto-Medium.ttf',
                italics: 'Roboto-Italic.ttf',
                bolditalics: 'Roboto-MediumItalic.ttf'
            }
        };
        pdfMake.createPdf(docDefinition).open();

        /*outobj = { fontSize:fntsiz, lines:outlin, x1: op.LEFT_MARGIN, twoColumn: usetwo, pageSize: pagsiz, fileName: filnam };
        if(usetwo) {
            outobj.x2 = (pagwid+op.COLUMN_MARGIN)/2;
        }
        outjso = JSON.stringify(outobj);
        $("#OutputJson").val(outjso);
        $("#OutForm").submit();
        */
        op.storeChords();
    },
    getHeading:function() {
        var txtall, heatxt, li;
        txtall = op._.i$.val();

        for(li = 0; li < op._.lines.length; li++) {
            if(op._.lines[li].inHeading) {
                heatxt = op._.lines[li].text;
                break;
            }
        }
        return heatxt;
    },
    storeChords:function() {
        op.useStorage(function() {
            var txtall = op._.i$.val(),
                heatxt = op.getHeading();
            localStorage.setItem(op.LS_STORE_CHORDS+heatxt,txtall);
            op.showPreviousChords();
        });
    },
    getSizes:function(pagwid,paghig,maxlen,outlin) {
        var linsiz, fntsiz, pagcol;
        linsiz = (paghig)/Math.max(20,outlin.length+1);//initially tentative
        fntsiz = Math.floor(linsiz/op.LINE_TO_FONT);
        if(fntsiz > op.MAX_FONT) {
            fntsiz = op.MAX_FONT;
            linsiz = op.LINE_TO_FONT*fntsiz;
        }        
        pagcol = (op.FONT_TIMES_WIDTH*pagwid/fntsiz);
        if(maxlen > pagcol) { 
            fntsiz = Math.floor(op.FONT_TIMES_WIDTH*pagwid/maxlen);
            linsiz = op.LINE_TO_FONT*fntsiz;
            pagcol = (op.FONT_TIMES_WIDTH*pagwid/fntsiz);
        }
        if(fntsiz > op.MAX_FONT) {
            fntsiz = op.MAX_FONT;
            linsiz = op.LINE_TO_FONT*fntsiz;
        }
        return { fontSize: fntsiz, lineSize: linsiz };
    },
    showPreviousChords:function() {
        op.useStorage(function() {
            var lst, li;
            $("#Previous li:gt(0)").remove();
            lst = [];
            for(li = 0; li < localStorage.length; li++) {
                var key = localStorage.key(li);
                if(key.indexOf(op.LS_STORE_CHORDS) !== 0) continue;
                lst.push(key.split(op.LS_STORE_CHORDS).pop());
            }
            if(lst.length === 0) return;
            lst.sort();
            $("#Previous").append(mu.PreviousLinks.th({links:lst})).removeClass("hidden");
        });

    },  
    loadChords:function(keysfx) {
        op.useStorage(function() {
            var txt = localStorage.getItem(op.LS_STORE_CHORDS+keysfx);
            op._.i$.val(txt);
            op.parseText();
            op.togglePreviousChords();
        });
    },
    removeChords:function(keysfx,ele) {
        $(ele.parentNode).slideUp("fast",function() { $(this).remove(); });
        op.useStorage(function() {
            localStorage.removeItem(op.LS_STORE_CHORDS+keysfx);
        });
    },
    togglePreviousChords:function(opn) {
        opn = ( typeof opn == "undefined" ? op._.p$.hasClass("closed") : opn );
        if(opn) {
            op._.p$.removeClass("closed");
        }
        else {
            op._.p$.addClass("closed");
        }
    }
};

var mu = {
    init:function(clb) {
        mu.onload = clb;
        $.ajax({url:"v1/mustache.html", success:function(dta) { mu.load(dta); }});
    },
    load:function(tpltxt) {
        var mi, musarr, musidn, subhtm, toohtm;
        musarr = tpltxt.split("<mustache id=\"");
        toohtm = function(obj) {
            return Mustache.to_html(this.template,obj);
        };
        for(mi = 1; mi < musarr.length; mi++) {
            musidn = musarr[mi].substring(0,musarr[mi].indexOf("\""));
            subhtm = musarr[mi].substring(musarr[mi].indexOf(">")+1,musarr[mi].indexOf("</mustache>"));
            this[musidn] = {
                th:toohtm,
                template:subhtm
            };
        }
        $("#MustacheTemplates").remove();
        mu.onload();
    }
};
