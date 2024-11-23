## Access Simulation

This script simulates access to different interfaces of DayTrader (JSP, JSF, and
JAX-RS). JSP is accessed 70% of the time, JSF 10%, and JAX-RS 20%.

Accesses to JAX-RS simply quote a random stock.

Accesses to JSP and JSF simulate the behavior of real users. Each endpoint has a
defined chance of being accessed while the user is logged in. These endpoints
are repeatedly accessed until the user logs out. Update and Register also log
out the user.

* Login: 100%
    1. Quote: 36%
    2. Home: 16%
    3. Portfolio: 15%
    4. Account: 10%
    5. Market Summary: 8%
    6. Buy: 4%
    7. Sell: 4%
    8. Update: 2%
    9. Register: 1%
    10. Logout: 4%

Between each access to one of the endpoints above, there is a configurable
`$MAXTHINKTIME` variable. This variable follows the [Weibull
distribution](https://en.wikipedia.org/wiki/Weibull_distribution).

According to the [Nielsen Norman
Group](https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/), a
web page must communicate its intent within 10 seconds. Furthermore, [Chao Liu
from Microsoft](https://dl.acm.org/doi/10.1145/1835449.1835513) provided a
mathematical model of users' page-leaving behavior. 

In this script, the user's page-leave behavior is modeled by the previously mentioned
Weibull distribution, where `$MAXTHINKTIME` represents the time when the
majority of users leave the page, according to Nielsen, `$MAXTHINKTIME` should
be set around 10 seconds. The current implementation considers a constant rate
of users leaving around `$MAXTHINKTIME`. For more details about how to change
this behavior, see the implementations of `weibullPDF` and `thinking_time`.
