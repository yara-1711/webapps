/*
 * Sort, page, and CSV helpers shared by the list apps.
 */
(function () {
    function asText(value) {
        return value == null ? "" : String(value);
    }

    function compare(a, b, column) {
        var av = a[column];
        var bv = b[column];
        var aText = asText(av).trim();
        var bText = asText(bv).trim();
        var aNum = Number(aText);
        var bNum = Number(bText);
        var bothNumeric = aText !== "" && bText !== "" &&
            !isNaN(aNum) && !isNaN(bNum) &&
            /^-?\d+(\.\d+)?$/.test(aText) &&
            /^-?\d+(\.\d+)?$/.test(bText);

        if (bothNumeric) {
            return aNum - bNum;
        }

        return aText.localeCompare(bText, undefined, {
            numeric: true,
            sensitivity: "base"
        });
    }

    function sortBy(items, column, order) {
        var direction = order === "DESC" ? -1 : 1;
        return items.slice().sort(function (a, b) {
            return compare(a, b, column) * direction;
        });
    }

    function paginate(items, page, perPage) {
        var totalPages = Math.max(1, Math.ceil(items.length / perPage));
        var safePage = Math.min(Math.max(page, 1), totalPages);
        var start = (safePage - 1) * perPage;
        return {
            page: safePage,
            totalPages: items.length === 0 ? 0 : totalPages,
            rows: items.slice(start, start + perPage)
        };
    }

    function csvCell(value) {
        var text = asText(value).replace(/"/g, '""');
        return '"' + text + '"';
    }

    function downloadCsv(filename, headers, rows) {
        var lines = [headers.map(csvCell).join(",")];
        rows.forEach(function (row) {
            lines.push(row.map(csvCell).join(","));
        });
        var file = new Blob([lines.join("\n")], { type: "text/csv" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    window.Records = {
        sortBy: sortBy,
        paginate: paginate,
        downloadCsv: downloadCsv
    };
})();
