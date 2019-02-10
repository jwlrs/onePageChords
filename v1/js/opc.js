var op = {//chord printer
    NOTES:"A, A#, Bb, B, C, C#, Cb, D, D#, Eb, E, F, F#, Gb, G, G#, Ab".split(", "), 
    MODS:", 7, 9, m, dim, aug, +, m7, m9, 7m, 9m".split(", "), 
    BOTTOM_PAD: 60, 
    DROP_BOILERPLATE: ["©", "to cell phone", "improve your playing", "contact us", "by following the link above"],
    INTERNAL_BOILERPLATE: ["[verse 1]", "[verse 2]", "[verse 3]", "[verse]", "[intro]"].join(''), 
    LS_PAPER_SIZE: "OnePageChord_PaperSize", 
    LS_STORE_CHORDS: "OnePageChord_Chords:", 
    _: {}, 
    init: function() {
        op._.w$ = $(window);
        op._.i$ = $("#Input");
        op._.o$ = $("#Out");
        op._.p$ = $("#Previous");
        op.resize();
        mu.init(op.show);
    }, 
    show: function(){
        window.onresize = op.resize;
        op.restoreSize();
        op.showPreviousChords();
        op.disableOutput();
        op.parseText();
        op.INPUT_LINE_HEIGHT = Number(op._.i$.css("lineHeight").split("px").shift());
        op.OUT_LINE_HEIGHT   = Number(op._.o$.css("lineHeight").split("px").shift());
    },
    useStorage: function(fnc) {
        if(!localStorage) return;
        try { fnc(); } catch(e) {}
    },        
    clear: function() {
        op._.lines = [];
        op._.linesShown = 0;
        op._.i$.val("");
        op._.o$.html(mu.OutputInitialMessage.th());
    }, 
    save: function() {
        op.storeChords();
        op.togglePreviousChords(true);
        op.clear();
        setTimeout(function() { op.togglePreviousChords(false); }, 1000);
    }, 
    resize: function() {
        var inputTop = op._.i$.position().top, 
            windowHeight = op._.w$.height(), 
            inputHeight = ( windowHeight - inputTop - op.BOTTOM_PAD );
        op._.i$.stop().css({ height: inputHeight });
        op._.o$.stop().css({ height: inputHeight }).show();
        op._.panelHeight = inputHeight;
    }, 
    disableOutput: function() {
        op._.o$.html(mu.OutputInitialMessage.th());
        $("#Submit, #Size").attr("disabled", "disabled").removeAttr("title");
        $("#SizeWrap").addClass("disabled");
        $("#Out").attr("title", "Paste in Chords & Lyrics to the left, and verify the results here on the right.");
    }, 
    enableOutput: function() {
        $("#Submit, #Size").removeAttr("disabled");
        $("#SizeWrap").removeClass("disabled");
        $("#Out").attr("title", "Click on lines to hide/show them in the final PDF");
        $("#Submit").attr("title", "If you are happy with the results above, click here to get a PDF");
        $("#Size").attr("title", "Change the PDF paper size");
    }, 
    parseText: function() {
        //todo: this is too big, split up!!
        //basic setup
        var textAll, textLines, lineObjects, notePatterns, noteRegexes, spaceRegex, 
          noteMatches, noteMatchCount, spaceMatches, 
          leadSpaces, textLength, lastChar, inPrint, dontPrint, line, 
          notesLast, notesStart, notesEnd, stop, 
          prevBlank, orgPrevBlank, bi, li, mi, ni, 
          printCount, titleLine, shownCount;
          
        textAll = op._.i$.val();
        if(textAll === "") {
            op.disableOutput();
            return; 
        }
        textAll = textAll.split("’").join("'").split("‘").join("'").split("“").join("\"").split("”").join("\"");//replace smart quotes
        textLines = textAll.split("\n");
        op._.linesTotal = textLines.length;
        lineObjects = [];
        
        //note detection & regexes
        notePatterns = [];
        for(ni = 0; ni < op.NOTES.length; ni++) { 
            for(mi = 0; mi < op.MODS.length; mi++) {
                notePatterns.push(op.NOTES[ni]+op.MODS[mi]);
            }
        }
        notePatterns.push("N\\.C\\.", "NC");
        noteRegexes = new RegExp("(^|\\b)+(" + notePatterns.join("|")+")($|\\b)+", "g");
        spaceRegex = /\s*/g;

        //first pass line by line processing:
        for(li = 0; li < textLines.length; li++) {
            noteMatches = textLines[li].match(noteRegexes);
            noteMatchCount = ( noteMatches ? noteMatches.length : 0 );
            textLines[li] = textLines[li].replace(/\t/g, '    ').replace(/\s/g, ' ');//sometimes there are other space chars used
            spaceMatches = textLines[li].match(spaceRegex);
            leadSpaces = ( spaceMatches && spaceMatches.length > 0 ? spaceMatches[0].length : 0 );
            if(textLines[li].length == leadSpaces) { textLines[li] = ""; }
            textLength = textLines[li].length;
            if(textLength === 0 && lineObjects.length > 0 && lineObjects[lineObjects.length - 1].length === 0) continue; //just skip multiple blank lines
            lastChar = textLines[li].charAt(textLines[li].length - 1);
            inPrint = ( lastChar == "+" );
            dontPrint = ( lastChar == "-" );
            line = { 
                noteHits: noteMatchCount, 
                text: ( inPrint || dontPrint ? textLines[li].substring(0, textLines[li].length - 1) : textLines[li] || "" ), 
                length: textLength, 
                leadSpaces: leadSpaces, 
                lastChar: lastChar,
                originalDontPrint: dontPrint,
                originalInPrint: inPrint,
                inPrint: inPrint, 
                dontPrint: dontPrint, 
                inHeading: false, 
                index: li
            };
            line.textLow = line.text.toLowerCase();
            lineObjects.push(line);
        }

        //attempt to determine start and end of the actual body:
        notesLast = -1;//the last notes we passed
        notesStart = -1;//where notes start
        notesEnd = lineObjects.length - 1;//where notes end
        for(li = 0; li < lineObjects.length; li++) {
            if(notesStart < 0 && notesLast > 0) { //we have no start yet, but current notesLast is set
                if(lineObjects[li].noteHits > 0 && li - notesLast < 10) {
                    notesStart = notesLast;
                }
            }
            if(notesStart > - 1 && lineObjects[li].noteHits > 0 && (li == lineObjects.length - 1 || lineObjects[li + 1].length > 0)) { //we have a start, and there are notes
                notesEnd = li + 1;
            }
            if(lineObjects[li].noteHits > 0) {
                notesLast = li;
            }
            if(!lineObjects[li].dontPrint && lineObjects[li].textLow.indexOf("capo") > - 1 && lineObjects[li].textLow.indexOf("following the link") < 0) {
                lineObjects[li].inPrint = true;
            }
            /*if(!lineObjects[li].dontPrint && lineObjects[li].textLow.indexOf("tuning") > - 1 && lineObjects[li].length > "tuning".length + 5 ) {
                lineObjects[li].inPrint = true;
            }*/
        }

        //find first line with "by" before proper inPrint and add it as a candidate title line
        for(li = 0; li < notesStart; li++) {
            if(!lineObjects[li].dontPrint && lineObjects[li].textLow.indexOf(" by ") > 3 && 
              lineObjects[li].textLow.indexOf(" by ") < lineObjects[li].text.length - 7 && 
              lineObjects[li].textLow.indexOf("browse by ") < 0 && 
              lineObjects[li].textLow.indexOf("search songs by chords") < 0 && 
              lineObjects[li].textLow.indexOf("filter them by genre") < 0 && 
              lineObjects[li].textLow.indexOf("following the link above") < 0) {
                lineObjects[li].inPrint = true;
                break;
            }
        }

        //special ultimate guitar filter
        for(li = Math.max(notesStart, 0); li < Math.min(notesEnd, lineObjects.length ); li++) {
            console.log(lineObjects[li].text + '  ' +  lineObjects[li].text.indexOf('STRUMMING'));
            if(lineObjects[li].text.indexOf('STRUMMING') > -1) {
                notesStart = li+1;
                console.log('strumming, ' + notesStart);
            }
        }
        for(li = Math.max(notesStart, 0); li < Math.min(notesEnd, lineObjects.length ); li++) {
            if(lineObjects[li].textLow.indexOf('by helping ug you make the world better') > -1 ) {
                notesEnd = li - 1;
                console.log('helping ug, ' + notesEnd);
            }
        }

        //remove extraneous boilerplate lines
        printCount = 0;
        for(li = Math.max(notesStart, 0); li <= notesEnd; li++) {
            if(!lineObjects[li]) continue;
            if(lineObjects[li].text.indexOf("---") > - 1) continue; //chord or tab diagrams
            if(printCount > 5) {
                stop = false;
                for(bi = 0; bi < op.DROP_BOILERPLATE.length; bi++) {
                    if(lineObjects[li].textLow.indexOf(op.DROP_BOILERPLATE[bi]) > - 1) {
                        lineObjects[li].inPrint = false;
                        notesEnd = li;
                        stop = true;
                        break;
                    }
                }
                if(stop) break;
            }
            if(!lineObjects[li].dontPrint) {
                lineObjects[li].inPrint = true;
                printCount++;
            }
        }

        //figure out title            
        titleLine = 0;
        for(li = 0; li < lineObjects.length; li++) {
            if(lineObjects[li].inPrint) { 
                titleLine = li; 
                break;
            }
        }
        lineObjects[titleLine].inHeading = true; 

        if(lineObjects[titleLine].text.indexOf(', added: ') > -1) { //ultimate guitar boilerplate
            lineObjects[titleLine].text = lineObjects[titleLine].text.split(', added: ')[0];
        }
        
        for(li = 0; li < lineObjects.length; li++) {
            if(!lineObjects[li].inPrint) continue;
            
            if(lineObjects[li].inHeading && !lineObjects[li].dontPrint) { 
                lineObjects[li].text = lineObjects[li].text.replace(/^\s*/, "");
                lineObjects[li].text = lineObjects[li].text.split(" chords by ").join(" by ").split(", added :").shift();
                lineObjects[li].length = lineObjects[li].text.length;
                lineObjects.splice(li + 1, 0, { 
                    noteHits: 0, 
                    text: "   ", 
                    length: 3, 
                    leadSpaces: 0, 
                    inPrint: true, 
                    inHeading: true, 
                    index: - 1
                });       
                break;
            }
        }

        //remove double blank lines
        prevBlank = false;
        shownCount = 0;
        for(li = 0; li < lineObjects.length; li++) {
            if(!lineObjects[li].inPrint) continue;
            shownCount++;
            if(lineObjects[li].length === 0 && prevBlank) { lineObjects[li].inPrint = false; continue; }
            if(lineObjects[li].length === 0) {
                prevBlank = true;
                lineObjects[li].inPrint = true;
            } else {
                prevBlank = false;
            }
        }

        /* remove junk like [VERSE 1] */
        for(li = 0; li < lineObjects.length; li++) {
            if(!lineObjects[li].inPrint) continue;
            if(op.INTERNAL_BOILERPLATE.indexOf(lineObjects[li].textLow) > -1 && !lineObjects[li].originalInPrint) {
                lineObjects[li].inPrint = false; //dont print the [VERSE 1]
                if(!lineObjects[li].originalDontPrint) {
                    lineObjects[li - 1].inPrint = true; //but print the blank line before it
                }
            }
        }

        /* this seems to no longer be helpful but leaving here in case...
        prevBlank = false;
        orgPrevBlank = false;
        for(li = 0; li < lineObjects.length - 1; li++) {
            if(!lineObjects[li].inPrint) continue;
            if(lineObjects[li].length > 0) continue; //nonblank lines we ignore
            orgPrevBlank = prevBlank;
            prevBlank = true;
            if(lineObjects[li + 1].noteHits > 0) continue; //if the next line is notes, don't remove blank line
            if(lineObjects[li + 1].text.indexOf(":") == lineObjects[li + 1].text.length - 1) continue; //don't remove before something like "Chorus:" or "Verse:"
            if(orgPrevBlank) lineObjects[li].inPrint = false;
        }*/

        for(li = 0; li < lineObjects.length - 1; li++) {
            lineObjects[li].substituteText = ( lineObjects[li].text.trim().length === 0 || lineObjects[li].text.trim().length == lineObjects[li].leadSpaces ? mu.SpaceLine.th({}) : lineObjects[li].text );
        }

        if(shownCount > 0) { op.enableOutput(); } else { op.disableOutput(); }
        var output = mu.Lines.th({lines: lineObjects});
        $("#Out").html(output);
        op._.lines = lineObjects;
        op._.linesShown = shownCount;
    }, 
    restoreSize: function() {
        op.useStorage(function() {
            var siz = localStorage.getItem(op.LS_PAPER_SIZE);
            if(siz) { $("#Size").val(siz); }
        });
    },        
    changeSize: function() {
        op.useStorage(function() {
            localStorage.setItem(op.LS_PAPER_SIZE, $("#Size").val());
        });
    }, 
    toggleInPrint: function(ele) {
        var index, className, inPrint, textAll, textLines, scrollTop;
        index = Number(ele.id.split("_").pop());
        if(index < 0) return;
        className = ele.className;
        inPrint = (className.indexOf("inPrint") > - 1);

        textAll = op._.i$.val();
        textLines = textAll.split("\n");

        if(inPrint) {
            if(textLines[index].charAt(textLines[index].length - 1) == "-" || textLines[index].charAt(textLines[index].length - 1) == "+") {
                textLines[index] = textLines[index].substring(0, textLines[index].length - 1);
            }
            textLines[index] += "-";
        }
        else {
            if(textLines[index].charAt(textLines[index].length - 1) == "-" || textLines[index].charAt(textLines[index].length - 1) == "+") {
                textLines[index] = textLines[index].substring(0, textLines[index].length - 1);
            }
            textLines[index] += "+";
        }
            
        scrollTop = op._.i$.scrollTop();
        op._.i$.val(textLines.join("\n")).scrollTop(scrollTop);
        op.parseText();
    },  
    MAX_FONT: 14, 
    LEFT_MARGIN: 72, //leaves a nice left margin for hole punches
    RIGHT_MARGIN: 54, 
    COLUMN_MARGIN: 54,    
    TOP_MARGIN: 54, 
    BOTTOM_MARGIN: 54, 
    LETTER_PAGE_HEIGHT: 792, 
    LETTER_PAGE_WIDTH: 612, 
    A4_PAGE_HEIGHT: 842, 
    A4_PAGE_WIDTH: 595, 
    LINE_TO_FONT: 1, 
    FONT_TIMES_WIDTH: 1.6333, 
    prepareAndSubmit: function() {
        var maxLength, outputLines, pageSize, pageWidth, pageHeight, 
            oneColumnDimension, twoColumnDimension, useTwo, lineSize, 
            fontSize, columnLines, dis, contentHeight, offsetTwo, 
            outputObject, outputJson, fileName, li;
        maxLength = 0;
        outputLines = [];
        for(li = 0; li < op._.lines.length; li++) {
            if(!op._.lines[li].inPrint) continue;
            outputLines.push(op._.lines[li].text.split("\"").join("\\\"").split("“").join("\\\"").split("”").join("\\\""));
            maxLength = Math.max(maxLength, op._.lines[li].text.length);
        }

        if(outputLines.length === 0) { return; }
        
        pageSize = $("#Size").val().toUpperCase();
        pageWidth = op[pageSize+"_PAGE_WIDTH"];
        pageHeight = op[pageSize+"_PAGE_HEIGHT"];

        oneColumnDimension = op.getSizes(pageWidth-(op.LEFT_MARGIN+op.RIGHT_MARGIN), pageHeight-(op.TOP_MARGIN+op.BOTTOM_MARGIN), maxLength, outputLines);
        twoColumnDimension = op.getSizes((pageWidth-(op.LEFT_MARGIN+op.RIGHT_MARGIN+op.COLUMN_MARGIN))/2, 2*(pageHeight-(op.TOP_MARGIN+op.BOTTOM_MARGIN)), maxLength, outputLines);
        useTwo = ( twoColumnDimension.fontSize > oneColumnDimension.fontSize );
        lineSize = ( useTwo ? twoColumnDimension : oneColumnDimension ).lineSize;
        fontSize = ( useTwo ? twoColumnDimension : oneColumnDimension ).fontSize;

        columnLines = ( useTwo ? Math.floor(outputLines.length/2) : outputLines.length );
        if(useTwo && columnLines*lineSize < pageHeight && outputLines[columnLines - 1] !== "" && outputLines[columnLines] !== "") { //try and find a better split point
            dis = 1;
            while(dis < outputLines.length/2) { 
                if(columnLines-dis > 0 && outputLines[columnLines-dis] === "") {
                    columnLines = columnLines + 1-dis;
                    break;
                }
                else if(columnLines-dis < outputLines.length && outputLines[columnLines+dis] === "") {
                    columnLines = columnLines + 1+dis;
                    break;
                }
                dis++;
            }
        }

        contentHeight = Math.ceil(lineSize*outputLines.length/( useTwo ? 2 : 1));//content height
        offsetTwo = ( !useTwo ? 0 : outputLines[columnLines] === "" ? 0 : 1 ); 
        var title = outputLines.shift();
        for(li = 0; li < outputLines.length; li++) {
            if(li < columnLines) {
                outputLines[li] = { y: li * lineSize + op.TOP_MARGIN, tx: outputLines[li], c: 1 };
            }
            else {
                outputLines[li] = { y: (li + offsetTwo-columnLines) * lineSize+op.TOP_MARGIN, tx: outputLines[li], c: 2 };
            }
        }
        fileName = op.getHeading().replace(" by ", "-").replace(/[^-|^\w|^\d]/g, "")+".pdf";



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
                    fontSize: fontSize
                }
            }, 
            //[left, top, right, bottom]
            pageMargins: [70, 50, 30, 30]
        };
        if(!useTwo) {
            docDefinition.content.push({
                style: 'body', 
                text: outputLines.map(function(line) { return line.tx; }).join('\n')
            });
        } else {
            docDefinition.content.push({
                columns: [
                    {
                        width: '49%', 
                        style: 'body', 
                        text: outputLines.filter(function(line) { return (line.c === 1); }).map(function(line) { return line.tx; }).join('\n')
                    }, 
                    { width: '2%', text: '' }, 
                    {
                        width: '49%', 
                        style: 'body', 
                        text: outputLines.filter(function(line) { return (line.c === 2); }).map(function(line) { return line.tx; }).join('\n')
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

        /*outputObject = { fontSize: fontSize, lines: outputLines, x1: op.LEFT_MARGIN, twoColumn: useTwo, pageSize: pageSize, fileName: fileName };
        if(useTwo) {
            outputObject.x2 = (pageWidth+op.COLUMN_MARGIN)/2;
        }
        outputJson = JSON.stringify(outputObject);
        $("#OutputJson").val(outputJson);
        $("#OutForm").submit();
        */
        op.storeChords();
    }, 
    getHeading: function() {
        var textAll, headText, li;
        textAll = op._.i$.val();

        for(li = 0; li < op._.lines.length; li++) {
            if(op._.lines[li].inHeading) {
                headText = op._.lines[li].text;
                break;
            }
        }
        return headText;
    }, 
    storeChords: function() {
        op.useStorage(function() {
            var textAll = op._.i$.val(), 
                headText = op.getHeading();
            localStorage.setItem(op.LS_STORE_CHORDS + headText, textAll);
            op.showPreviousChords();
        });
    }, 
    getSizes: function(pageWidth, pageHeight, maxLength, outputLines) {
        var lineSize, fontSize, pageColumns;
        lineSize = (pageHeight)/Math.max(20, outputLines.length + 1);//initially tentative
        fontSize = Math.floor(lineSize/op.LINE_TO_FONT);
        if(fontSize > op.MAX_FONT) {
            fontSize = op.MAX_FONT;
            lineSize = op.LINE_TO_FONT * fontSize;
        }        
        pageColumns = (op.FONT_TIMES_WIDTH * pageWidth/fontSize);
        if(maxLength > pageColumns) { 
            fontSize = Math.floor(op.FONT_TIMES_WIDTH * pageWidth/maxLength);
            lineSize = op.LINE_TO_FONT * fontSize;
            pageColumns = (op.FONT_TIMES_WIDTH * pageWidth/fontSize);
        }
        if(fontSize > op.MAX_FONT) {
            fontSize = op.MAX_FONT;
            lineSize = op.LINE_TO_FONT * fontSize;
        }
        return { fontSize: fontSize, lineSize: lineSize };
    }, 
    showPreviousChords: function() {
        op.useStorage(function() {
            var list, li;
            $("#Previous li: gt(0)").remove();
            list = [];
            for(li = 0; li < localStorage.length; li++) {
                var key = localStorage.key(li);
                if(key.indexOf(op.LS_STORE_CHORDS) !== 0) continue;
                list.push(key.split(op.LS_STORE_CHORDS).pop());
            }
            if(list.length === 0) return;
            list.sort();
            $("#Previous").append(mu.PreviousLinks.th({links: list})).removeClass("hidden");
        });

    },  
    loadChords: function(keySuffix) {
        op.useStorage(function() {
            var text = localStorage.getItem(op.LS_STORE_CHORDS+keySuffix);
            op._.i$.val(text);
            op.parseText();
            op.togglePreviousChords();
        });
    }, 
    removeChords: function(keySuffix, ele) {
        $(ele.parentNode).slideUp("fast", function() { $(this).remove(); });
        op.useStorage(function() {
            localStorage.removeItem(op.LS_STORE_CHORDS + keySuffix);
        });
    }, 
    togglePreviousChords: function(open) {
        open = ( typeof open == "undefined" ? op._.p$.hasClass("closed") : open );
        if(open) {
            op._.p$.removeClass("closed");
        }
        else {
            op._.p$.addClass("closed");
        }
    }
};

var mu = {
    init: function(clb) {
        mu.onload = clb;
        $.ajax({url:"v1/mustache.html", success: function(dta) { mu.load(dta); }});
    }, 
    load: function(tpltxt) {
        var mi, mustacheArray, mustachId, subsHtml, toHtml;
        mustacheArray = tpltxt.split("<mustache id=\"");
        toHtml = function(obj) {
            return Mustache.to_html(this.template, obj);
        };
        for(mi = 1; mi < mustacheArray.length; mi++) {
            mustachId = mustacheArray[mi].substring(0, mustacheArray[mi].indexOf("\""));
            subsHtml = mustacheArray[mi].substring(mustacheArray[mi].indexOf(">") + 1, mustacheArray[mi].indexOf("</mustache>"));
            this[mustachId] = {
                th: toHtml, 
                template: subsHtml
            };
        }
        $("#MustacheTemplates").remove();
        mu.onload();
    }
};
