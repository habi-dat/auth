<template>
  <ag-grid-vue
    :localeText="aggridLocale.locale_de"
    :style="tableStyle"
    class="ag-theme-material"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :rowData="rowData"
    @grid-ready="onGridReadyHandler"
    @first-data-rendered="onFirstDataRendered"
    @row-clicked="onRowClicked"    
    :pagination="true"
    paginationPageSize="25"
  />
</template>

<script>
import axios from 'axios'
import moment from 'moment'
import router from '../../router'
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import aggridLocale from '@/assets/ag-grid.locale.js';
import { AgGridVue } from "ag-grid-vue";
import ChipCell from '@/components/table/ChipCell'
export default {
  name: 'AuditTable',
  components: {
    AgGridVue,
    ChipCell,
  },
  props: {
    records: Array,
    search: String,
    heightOffset: Number,
  },
  data () {
    return {
      tableStyle: "",
      defaultColDef: [],
      columnDefs: [],
      rowData: [],
      aggridLocale: aggridLocale,
      gridApi: null,
      columnApi: null
    }
  },
  watch: {
    search(newSearch, oldSearch) {
      this.gridApi.setQuickFilter(newSearch);
      this.gridApi.onFilterChanged();
    },
    records(newRecords, oldRecords) {
      this.rowData = newRecords;
    }
  },
  methods: {
    onGridReadyHandler(params) {
      this.gridApi = params.api;
      this.columnApi = params.columnApi;
      this.$emit('onGridReady', params);
    },
    onFirstDataRendered(params) {
      this.columnApi.autoSizeAllColumns();
      this.$emit('onDataRendered');
    },
    onRowClicked(event) {
      const row = event.data;
      console.log(row);
      this.$emit('onRowClicked', row);
    }
  },
  created() {
    this.tableStyle = "width: 100%; height: calc(100% - " + (this.heightOffset || 0) +"px);"
    var textStyle = { 'line-height': 'normal', 'padding-top': '14px', 'padding-bottom': '14px'}
    this.columnDefs = [];
    this.columnDefs.push(
        { 
          headerName: "Wer", field: "user", cellStyle: {'white-space': 'normal'}, maxWidth: 300, autoHeight: true ,cellRenderer: 'ChipCell', cellRendererParams: {  color: 'info', field: 'cn', tooltip: 'user'}
        }
      )
    this.columnDefs.push(
      { headerName: "Wann", cellStyle: textStyle, field: "createdAt",
        valueFormatter: function (params) {
          return moment(params.value).fromNow();
        }
      },)
    this.columnDefs.push(
      { headerName: "Was", field: "text", cellStyle: textStyle},
    );

    this.defaultColDef = {
      resizable: true,
      filterable: true,
      sortable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 'word-break': 'normal'}
    };
    this.rowData = this.records;

  },
}
</script>
