<template>
  <v-snackbar v-model="show" text top center :color="color" :timeout="timeout" multi-line>
    <v-layout align-center pr-4>
      <v-icon class="pr-3" large :color=color>{{ icon }}</v-icon>
      <v-layout column>
        <div>
          <strong>{{ title }}</strong>
        </div>
        <div>{{ message }}</div>
      </v-layout>
    </v-layout>
    <template v-slot:action="{ attrs }">
      <v-btn text v-bind="attrs" @click="show = false" :color=color><v-icon small>close</v-icon></v-btn>
    </template>
    <v-progress-linear
          v-if="timeout >= 0"
          :color=color
          absolute
          bottom
          :value="Math.floor(100 * (1-(currentTime / timeout)))"
        />
  </v-snackbar>
</template>

<script>
export default {
  data () {
    return {
      show: false,
      icon: 'check_circle',
      message: '',
      title: 'OK',
      timeout: -1,
      color: '',
      startTime: 0,
      currentTime: 0
    }
  },
  methods: {
    syncProgressBar: function() {
      setTimeout(() => {
        this.currentTime = Date.now() - this.startTime
        //If our current time is larger than the timeout
        if (this.timeout <=  this.currentTime) {
       } else {
         //Recursivly update the progress bar
         this.syncProgressBar();
       }
     }, 100);

    }
  },
  created () {
    this.$store.subscribe((mutation, state) => {
      if (mutation.type === 'showMessage') {
        this.message = state.notification.content
        this.color = state.notification.color
        this.icon = state.notification.icon
        this.timeout = state.notification.timeout
        this.title = state.notification.title
        this.startTime = Date.now();
        this.currentTime = 0;
        this.show = true
        this.syncProgressBar()
      }
    })
  }
}
</script>
