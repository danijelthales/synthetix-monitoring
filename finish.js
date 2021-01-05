$(document).ready(function() {
    $('#dataTable').DataTable({
        "pageLength": 100,
        "lengthChange": false,
        "searching": true,
        "ordering": true,
        "info": true,
        "autoWidth": true,
        "order": [[2, 'desc']]
    });
});
